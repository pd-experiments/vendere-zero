// Contains methods for interacting with the Supabase database for this endpoint

import { supabase } from "@/lib/supabase";
import { AdStructuredOutputSchema } from "./schemas";
import { z } from "zod";
import { Database } from "@/lib/types/schema";

type AdStructuredOutput =
    Database["public"]["Tables"]["ad_structured_output"]["Insert"];
type Feature = Database["public"]["Tables"]["features"]["Insert"];
async function insertAdEvaluation(
    imageUrl: string,
    adEvaluation: z.infer<typeof AdStructuredOutputSchema>,
) {
    const { data: adStructuredOutputData, error: adStructuredOutputError } =
        await supabase
            .from("ad_structured_output")
            .insert({
                image_description: adEvaluation.image_description,
                image_url: imageUrl,
            })
            .select()
            .returns<AdStructuredOutput>()
            .maybeSingle();
    if (adStructuredOutputError) {
        throw adStructuredOutputError;
    } else if (!adStructuredOutputData) {
        throw new Error("No data returned from Supabase");
    }

    const adStructuredOutputId = (
        adStructuredOutputData as unknown as AdStructuredOutput
    ).id;

    const { data: featureData, error: featureError } = await supabase
        .from("features")
        .insert(
            adEvaluation.features.map((feature) => ({
                keyword: feature.keyword,
                confidence_score: feature.confidence_score,
                category: feature.category,
                location: feature.location,
                ad_output_id: adStructuredOutputId,
            })),
        )
        .select()
        .returns<Feature[]>();
    if (featureError) {
        throw featureError;
    }

    const featureIds = featureData.map((feature) => feature.id);

    const visualAttributeData = adEvaluation.features.flatMap((
        feature,
        index,
    ) => feature.visual_attributes.map((visualAttribute) => ({
        ...visualAttribute,
        feature_id: featureIds[index],
    })));

    const { error: visualAttributeError } = await supabase
        .from("visual_attributes")
        .insert(visualAttributeData);
    if (visualAttributeError) {
        throw visualAttributeError;
    }

    const { error: sentimentError } = await supabase
        .from("sentiment_analysis")
        .insert({
            tone: adEvaluation.sentiment_analysis.tone,
            confidence: adEvaluation.sentiment_analysis.confidence,
            ad_output_id: adStructuredOutputId,
        });
    if (sentimentError) {
        throw sentimentError;
    }
}

export { insertAdEvaluation };
