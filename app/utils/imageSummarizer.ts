import { groq } from "@/lib/ai";

export async function summarizeImage(imageUrl: string): Promise<string> {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Summarize the key visual elements, style, and overall impression of this image. Focus on aspects that could be relevant for advertising, such as color scheme, composition, and emotional impact.",
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
    max_tokens: 300,
    temperature: 0.2,
    top_p: 1,
    stream: false,
  });

  return chatCompletion.choices[0].message.content || "";
}

export async function summarizeReferenceImages(imageUrls: string[]): Promise<string> {
  const summaries = await Promise.all(imageUrls.map(summarizeImage));
  return summaries.join("\n\n");
}
