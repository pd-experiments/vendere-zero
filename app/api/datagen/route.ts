import { NextRequest, NextResponse } from "next/server";
import { createEmbeddings, storeAnalysisResults, uploadImageToBucket } from "./helpers";
import { AdStructuredOutputSchema } from "./models";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files.length) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const results = [];
    for (const file of files) {
      try {
        // Upload to Supabase storage first
        const imageUrl = await uploadImageToBucket(file);
        
        // Convert file to base64 for analysis
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;
        
        // Call evaluate endpoint
        const evaluateResponse = await fetch('/api/evaluate', {
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
        
        // Parse and validate the output
        const analysis = AdStructuredOutputSchema.parse({
          ...ad_description,
          image_url: imageUrl, // Use the Supabase storage URL
          description_embeddings: embeddings
        });
        
        // Store in database
        const id = await storeAnalysisResults(analysis);
        
        results.push({ 
          id,
          filename: file.name,
          imageUrl,
          status: "success" 
        });

      } catch (error) {
        results.push({
          filename: file.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error processing images:", error);
    return NextResponse.json(
      { error: "Failed to process images" },
      { status: 500 }
    );
  }
}
