import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import { cookies } from "next/headers";
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest) {
    try {
        const cookieStore = cookies();
        const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
        const host = req.headers.get('host') || 'localhost:3000';
        
        // Create server-side Supabase client with cookie auth
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        // Use getUser instead of getSession
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const formData = await req.formData();
        const videoFile = formData.get('video') as File;
        
        if (!videoFile) {
            return NextResponse.json(
                { error: "No video file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (!videoFile.type.startsWith('video/')) {
            return NextResponse.json(
                { error: "Invalid file type. Only video files are allowed." },
                { status: 400 }
            );
        }

        // Generate a unique filename with user's folder
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Convert File to Buffer for Supabase storage
        const arrayBuffer = await videoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage with content-type
        const { error: uploadError } = await supabase.storage
            .from('library_videos')
            .upload(filePath, buffer, {
                contentType: videoFile.type,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error("Error uploading to storage:", uploadError);
            return NextResponse.json(
                { error: "Failed to upload video" },
                { status: 500 }
            );
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
            .from('library_videos')
            .getPublicUrl(filePath);

        // Trigger video evaluation
        const evaluationResponse = await fetch(`${protocol}://${host}/api/evaluate-video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.get('cookie') || '',
            },
            body: JSON.stringify({
                videoUrl: publicUrl
            }),
        });

        const evaluationResult = await evaluationResponse.json();

        return NextResponse.json({
            success: true,
            videoUrl: publicUrl,
            evaluation: evaluationResult
        });

    } catch (error) {
        console.error("Error processing upload:", error);
        return NextResponse.json(
            { error: "Failed to process video upload" },
            { status: 500 }
        );
    }
} 