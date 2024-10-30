import { z } from "zod";

export const VisualAttributeSchema = z.object({
  attribute: z.string(),
  value: z.string()
});

export const FeatureSchema = z.object({
  keyword: z.string(),
  confidence_score: z.number().min(0).max(1),
  category: z.string(),
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
    "unknown"
  ]),
  visual_attributes: z.array(VisualAttributeSchema).optional()
});

export const SentimentAnalysisSchema = z.object({
  tone: z.string(),
  confidence: z.number().min(0).max(1)
});

export const AdStructuredOutputSchema = z.object({
  image_url: z.string(),
  image_description: z.string(),
  features: z.array(FeatureSchema),
  sentiment_analysis: SentimentAnalysisSchema,
  description_embeddings: z.array(z.number()).optional()
});

export type AdStructuredOutput = z.infer<typeof AdStructuredOutputSchema>;
