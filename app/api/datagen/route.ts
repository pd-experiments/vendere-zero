import { NextRequest, NextResponse } from "next/server";
import { createEmbeddings, storeAnalysisResults, uploadImageToBucket } from "./helpers";
import { AdStructuredOutputSchema } from "./models";
import { cookies } from "next/headers";
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const host = request.headers.get('host') || 'localhost:3000'
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files.length) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Process all files concurrently
    const processPromises = files.map(async (file) => {
      try {
        // Upload to Supabase storage
        const imageUrl = await uploadImageToBucket(file, supabase);
        
        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;
        
        // Call evaluate endpoint
        const evaluateResponse = await fetch(`${protocol}://${host}/api/evaluate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageData: base64Image,
            saveToDatabase: false
          })
        });

        if (!evaluateResponse.ok) {
          throw new Error(`Evaluation failed: ${evaluateResponse.statusText}`);
        }

        const { ad_description } = await evaluateResponse.json();
        
        // Generate embeddings
        const embeddings = await createEmbeddings(ad_description.image_description);
        
        // Parse and validate
        const analysis = AdStructuredOutputSchema.parse({
          ...ad_description,
          image_url: imageUrl,
          description_embeddings: embeddings
        });
        
        // Store in database
        const id = await storeAnalysisResults(analysis, user.id, supabase);
        
        return { 
          id,
          filename: file.name,
          imageUrl,
          status: "success" as const
        };

      } catch (error) {
        console.error("Error processing image:", error);
        return {
          filename: file.name,
          status: "error" as const,
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    });

    // Wait for all files to be processed
    const results = await Promise.all(processPromises);

    return NextResponse.json({ results });
    
  } catch (error) {
    console.error("Error processing images:", error);
    return NextResponse.json(
      { error: "Failed to process images" },
      { status: 500 }
    );
  }
}
