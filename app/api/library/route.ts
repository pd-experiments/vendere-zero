import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = createServerSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch videos with frames and construct the data in SQL
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select(`
                id,
                name,
                description,
                video_url,
                created_at,
                video_frames_mapping (
                    id,
                    frame_number,
                    video_timestamp,
                    frame_id,
                    frame:ad_structured_output (
                        id,
                        image_url,
                        image_description,
                        features (
                            keyword,
                            confidence_score,
                            category,
                            location,
                            visual_attributes (*)
                        ),
                        sentiment_analysis (
                            tone,
                            confidence
                        )
                    )
                )
            `)
            .eq('user_id', user.id);

        if (videosError) {
            return NextResponse.json({ error: "Error fetching videos: " + videosError.message }, { status: 500 });
        }

        // Fetch standalone images
        const { data: images, error: imagesError } = await supabase
            .from('ad_structured_output')
            .select(`
                id,
                name,
                image_url,
                image_description,
                features (
                    keyword,
                    confidence_score,
                    category,
                    location,
                    visual_attributes (*)
                ),
                sentiment_analysis (
                    tone,
                    confidence
                )
            `)
            .eq('user', user.id);

        if (imagesError) {
            return NextResponse.json({ error: "Error fetching images: " + imagesError.message }, { status: 500 });
        }

        // Construct library items
        const libraryItems = [
            ...(videos || []).map(video => ({
                id: video.id,
                type: 'video',
                name: video.name,
                video: {
                    id: video.id,
                    name: video.name,
                    description: video.description,
                    video_url: video.video_url,
                    frames: video.video_frames_mapping.map(mapping => ({
                        mapping_id: mapping.id,
                        frame_id: mapping.frame_id,
                        image_url: mapping.frame[0].image_url || '',
                        image_description: mapping.frame[0].image_description || '',
                        frame_number: mapping.frame_number,
                        video_timestamp: mapping.video_timestamp,
                    }))
                },
                image_description: video.description || 'No description',
                features: video.video_frames_mapping[0]?.frame[0].features.map(feature => ({
                    keyword: feature.keyword,
                    confidence_score: feature.confidence_score,
                    category: feature.category,
                    location: feature.location,
                    visual_attributes: feature.visual_attributes
                })) || [],
                sentiment_analysis: {
                    tones: [video.video_frames_mapping[0]?.frame[0].sentiment_analysis[0]?.tone || ''],
                    confidence: video.video_frames_mapping[0]?.frame[0].sentiment_analysis[0]?.confidence || 0
                },
                created_at: video.created_at || new Date().toISOString()
            })),
            ...(images || []).map(image => ({
                id: image.id,
                type: 'image',
                name: image.name,
                image_url: image.image_url,
                image_description: image.image_description,
                features: image.features.map(feature => ({
                    keyword: feature.keyword,
                    confidence_score: feature.confidence_score,
                    category: feature.category,
                    location: feature.location,
                    visual_attributes: feature.visual_attributes
                })),
                sentiment_analysis: {
                    tones: [image.sentiment_analysis[0]?.tone || ''],
                    confidence: image.sentiment_analysis[0]?.confidence || 0
                },
                created_at: new Date().toISOString()
            }))
        ];

        return NextResponse.json(libraryItems, { status: 200 });
    } catch (error) {
        console.error("Error fetching library data:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}