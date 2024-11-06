import { SupabaseClient } from '@supabase/supabase-js';
import { openai } from "@/lib/ai";
import { AdStructuredOutput } from "./models";
import { Database } from '@/lib/types/schema';

// Define the type for the Supabase client with your database types
type TypedSupabaseClient = SupabaseClient<Database>;

export async function uploadImageToBucket(file: File, supabase: TypedSupabaseClient): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  
  const { error } = await supabase
    .storage
    .from('library_images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase
    .storage
    .from('library_images')
    .getPublicUrl(fileName);

  return publicUrl;
}

export async function createEmbeddings(description: string): Promise<number[]> {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: description,
  });
  return embedding.data[0].embedding;
}

export async function storeAnalysisResults(analysis: AdStructuredOutput, userId: string, supabase: TypedSupabaseClient): Promise<string> {
  const { data: outputData, error: outputError } = await supabase
    .from("ad_structured_output")
    .insert({
      name: analysis.name,
      image_url: analysis.image_url,
      image_description: analysis.image_description,
      description_embeddings: JSON.stringify(analysis.description_embeddings), // Convert array to string
      user: userId
    })
    .select('id')
    .single();
  
  if (outputError) throw outputError;
  if (!outputData) throw new Error('Failed to insert ad output');

  const { data: featuresData, error: featuresError } = await supabase
    .from("features")
    .insert(
      analysis.features.map(feature => ({
        ad_output_id: outputData.id,
        user: userId,
        keyword: feature.keyword,
        confidence_score: feature.confidence_score,
        category: feature.category,
        location: feature.location
      }))
    )
    .select('id');

  if (featuresError) throw featuresError;
  if (!featuresData) throw new Error('Failed to insert features');

  // Insert visual attributes for each feature if they exist
  for (let i = 0; i < analysis.features.length; i++) {
    const feature = analysis.features[i];
    const featureData = featuresData[i];
    
    if (feature.visual_attributes?.length) {
      const { error: visualAttrError } = await supabase
        .from("visual_attributes")
        .insert(
          feature.visual_attributes.map(attr => ({
            feature_id: featureData.id,
            attribute: attr.attribute,
            value: attr.value
          }))
        );
      
      if (visualAttrError) throw visualAttrError;
    }
  }

  // Finally insert sentiment analysis
  const { error: sentimentError } = await supabase
    .from("sentiment_analysis")
    .insert({
      ad_output_id: outputData.id,
      user: userId,
      tone: analysis.sentiment_analysis.tone,
      confidence: analysis.sentiment_analysis.confidence
    });
    
  if (sentimentError) throw sentimentError;

  return outputData.id;
}
