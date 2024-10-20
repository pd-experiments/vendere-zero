import { groq } from "@/lib/ai";
import fs from 'fs/promises';

async function summarizeImage(imagePath: string): Promise<string> {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Summarize this image in one sentence:" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
          ],
        },
      ],
      model: "mixtral-8x7b-32768",
    });

    return completion.choices[0]?.message?.content || "Unable to summarize image.";
  } catch (error) {
    console.error('Error summarizing image:', error);
    return "Error summarizing image.";
  }
}

export async function summarizeReferenceImages(imagePaths: string[]): Promise<string> {
  try {
    const summaries = await Promise.all(imagePaths.map(summarizeImage));
    return summaries.join('\n');
  } catch (error) {
    console.error('Error summarizing reference images:', error);
    return "Error summarizing reference images.";
  }
}
