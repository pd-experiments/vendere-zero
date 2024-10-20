// Contains the route handler for the evaluate endpoint

import { NextRequest, NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { groq, openai } from "@/lib/ai";
import { AdStructuredOutputSchema } from "./schemas";
import { insertAdEvaluation } from "./dao";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { imageUrl, saveToDatabase } = body;

  if (!imageUrl) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 },
    );
  }

  console.log("Starting image processing");

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "You are an assistant that evaluates image-based ads. Given the following image, write a large essay on the visual features, shapes, colors, actions, and placement of features of the image ad. Be as detailed as possible, while only describing the visual features of the image. For each feature, include where the feature is located in the image.",
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      },
    ],
    model: "llava-v1.5-7b-4096-preview",
    // model: "llama-3.2-90b-vision-preview",
    max_tokens: 2048,
    temperature: 0.2,
    top_p: 1,
    stream: false,
  });

  const description = chatCompletion.choices[0].message.content;

  console.log("Finished processing image");

  //   return NextResponse.json({ description });

  if (!description) {
    return NextResponse.json(
      { error: "No description found" },
      { status: 400 },
    );
  }

  const keyword_gen_prompt = `
You are tasked with analyzing the following ad image description and generating structured output for ad performance analysis. First, extract a few descriptive keywords and classify each into general categories such as "emotion", "object", or "background". For each keyword, provide additional details on any specific visual features, such as color, lighting, or object size. Next, assess the overall sentiment or tone of the image. The goal is to organize the extracted features and sentiment into a format that can later be used to associate these features with performance metrics like Return on Ad Spend (ROAS) or conversion rates.

Here is the ad image description: {imageDescription}
  `;

  const response = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: keyword_gen_prompt.replace("{imageDescription}", description),
      },
    ],
    model: "gpt-4o-mini",
    response_format: zodResponseFormat(
      AdStructuredOutputSchema,
      "ad_description",
    ),
  });

  const ad_description = response.choices[0].message.parsed;

  console.log("Finished processing ad description");

  if (!ad_description) {
    return NextResponse.json(
      { error: "No ad description found" },
      { status: 400 },
    );
  }

  ad_description.image_description = description;

  if (saveToDatabase) {
    await insertAdEvaluation(imageUrl, ad_description);
    console.log("Finished inserting ad evaluation");
  }

  return NextResponse.json({ ad_description });
}
