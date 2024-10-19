import { Groq } from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { imageUrl } = body;

  if (!imageUrl) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 }
    );
  }

  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You are an assistant that evaluates image-based ads. Given the following image, return a list of keywords that best describe the features of the image ad. Keywords can be related to the product, the brand, the category, the overall mood, elements present, colors, shapes, placement of features, and design language.",
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
    temperature: 0.2,
    top_p: 1,
    stream: false,
  });

  return NextResponse.json(chatCompletion.choices[0].message.content);
}
