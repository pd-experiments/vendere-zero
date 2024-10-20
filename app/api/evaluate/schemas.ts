// Contains schemas for the evaluate endpoint

import { z } from "zod";

// Define the schema for visual attributes
const VisualAttributeSchema = z.object({
    attribute: z.string(), // e.g., "color", "lighting"
    value: z.string(), // e.g., "bright", "soft lighting"
});

// Define the schema for features
const FeatureSchema = z.object({
    keyword: z.string(), // The feature (e.g., "smiling person")
    confidence_score: z.number(), // Confidence score (between 0.0 and 1.0)
    category: z.string(), // Category (e.g., "emotion", "product", "brand", "person", "setting", "text", "call-to-action")
    visual_attributes: z.array(VisualAttributeSchema), // Array of visual attributes
    location: z.enum([
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-center",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
        "unknown",
    ]), // Location of the feature in the image
});

// Define the schema for sentiment analysis
const SentimentAnalysisSchema = z.object({
    tone: z.string(), // Overall tone (e.g., "positive", "serious")
    confidence: z.number(), // Confidence score (between 0.0 and 1.0)
});

// Define the full schema for the structured output
const AdStructuredOutputSchema = z.object({
    image_description: z.string(), // Raw description of the image
    features: z.array(FeatureSchema), // Array of features with their details
    sentiment_analysis: SentimentAnalysisSchema, // Sentiment analysis
});

export { AdStructuredOutputSchema };
