import { supabase } from "@/lib/supabase";
import { openai } from "@/lib/ai";
import { AdStructuredOutput } from "./models";

export async function uploadImageToBucket(file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  
  const { error } = await supabase
    .storage
    .from('library_images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
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

export async function storeAnalysisResults(analysis: AdStructuredOutput) {
  const { data: outputData, error: outputError } = await supabase
    .from("ad_structured_output")
    .insert({
      image_url: analysis.image_url,
      image_description: analysis.image_description,
      description_embeddings: analysis.description_embeddings
    })
    .select()
    .single();

  if (outputError) throw outputError;

  const { error: featuresError } = await supabase
    .from("features")
    .insert(
      analysis.features.map(feature => ({
        ad_output_id: outputData.id,
        ...feature
      }))
    );

  if (featuresError) throw featuresError;

  const { error: sentimentError } = await supabase
    .from("sentiment_analysis")
    .insert({
      ad_output_id: outputData.id,
      ...analysis.sentiment_analysis
    });

  if (sentimentError) throw sentimentError;

  return outputData.id;
}
