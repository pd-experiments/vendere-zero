import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { z } from 'zod';
import { zodResponseFormat } from "openai/helpers/zod";
import { parsePDF } from '@/app/utils/pdfParser';
import { summarizeReferenceImages } from '@/app/utils/imageSummarizer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const CompanyProfileSchema = z.object({
  name: z.string(),
  industry: z.string(),
  productOrService: z.string(),
  brandPersonality: z.string(),
});

const AdFeaturesSchema = z.object({
  style: z.string(),
  audience: z.string(),
  colors: z.array(z.string()),
  text: z.string(),
  goal: z.string(),
  includeFaces: z.boolean(),
  includeBrandLogo: z.boolean(),
  includeHandsFingers: z.boolean(),
  additionalElements: z.array(z.string()).optional(),
});

const AdRequestSchema = z.object({
  companyProfile: CompanyProfileSchema,
  adFeatures: AdFeaturesSchema,
  userPrompt: z.string(), 
});

type AdRequest = z.infer<typeof AdRequestSchema>;

interface LayerPrompt {
  description: string;
  prompt: string;
}

async function generateLayeredAdPrompts(request: AdRequest): Promise<LayerPrompt[]> {
  const requestString = JSON.stringify(request);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert advertising creative director. Your task is to create a series of prompts for generating a layered, simple, and clean ad image. Focus on creating 2-3 layers maximum, with each layer being a separate DALL-E generation."
      },
      {
        role: "user",
        content: `Based on this ad request: ${requestString}, create a series of 2-3 layer prompts for DALL-E to generate a simple, clean ad image. 

        Guidelines:
        1. First layer should always be a simple, minimalist background that sets the mood and color scheme.
        2. Second layer (optional) could be a main focal object or element that represents the brand or message.
        3. Third layer (optional) could be an additional element to enhance the message or brand identity.
        4. Do NOT include any text or words in any of the layers.
        5. Ensure each layer complements the others and maintains a clean, simple aesthetic.
        6. Consider the brand's color scheme and style in all layers.
        7. Leave appropriate space for text overlay in the final composition.

        Return the layers as a JSON array of objects, each with a 'description' and 'prompt' field.`
      }
    ],
    response_format: { type: "json_object" },
  });

  const layers = JSON.parse(response.choices[0].message.content || "[]");
  return layers.layers;
}

async function generateAndComposeImage(layerPrompts: LayerPrompt[]): Promise<{ layerUrls: string[], composedUrl: string }> {
  const layerUrls: string[] = [];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const layerBuffers: Buffer[] = [];

  for (let i = 0; i < layerPrompts.length; i++) {
    const layer = layerPrompts[i];
    let response;

    if (i === 0) {
      // Generate the first layer
      response = await openai.images.generate({
        model: "dall-e-3",
        prompt: layer.prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      layerBuffers.push(Buffer.from(response.data[0].b64_json || '', 'base64'));
    } else {
      // Create a transparent image for the new layer
      const transparentImage = await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      }).png().toBuffer();

      // Edit the image with the new layer
      response = await openai.images.edit({
        model: "dall-e-2",
        image: new File([transparentImage], 'image.png', { type: 'image/png' }),
        mask: new File([transparentImage], 'mask.png', { type: 'image/png' }),
        prompt: layer.prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      layerBuffers.push(Buffer.from(response.data[0].b64_json || '', 'base64'));
    }

    // Save each layer image
    const layerOutputPath = path.join(process.cwd(), 'generated', `layer_${Date.now()}.png`);
    await sharp(layerBuffers[i]).png().toFile(layerOutputPath);
    layerUrls.push(`${baseUrl}/generated/${path.basename(layerOutputPath)}`);
  }

  // Compose the final image by merging all layers
  let composedImage = sharp(layerBuffers[0]);
  for (let i = 1; i < layerBuffers.length; i++) {
    composedImage = composedImage.composite([
      {
        input: await sharp(layerBuffers[i])
          .ensureAlpha()
          .raw()
          .toBuffer(),
        raw: {
          width: 1024,
          height: 1024,
          channels: 4
        },
        blend: 'over'
      }
    ]);
  }

  // Save the final composed image
  const composedOutputPath = path.join(process.cwd(), 'generated', `composed_${Date.now()}.png`);
  await composedImage.png().toFile(composedOutputPath);
  const composedUrl = `${baseUrl}/generated/${path.basename(composedOutputPath)}`;

  return { layerUrls, composedUrl };
}

async function generateAdRequest(userPrompt: string, includeFaces: boolean, includeBrandLogo: boolean, includeHandsFingers: boolean): Promise<AdRequest> {
  try {
    const brandInfo = await parsePDF();

    const imagesDir = path.join(process.cwd(), 'refimages', 'nike');
    let imageFiles: string[];
    try {
      imageFiles = await fs.promises.readdir(imagesDir);
    } catch (error) {
      console.error('Error reading images directory:', error);
      imageFiles = [];
    }

    const imagePaths = imageFiles
      .filter(file => file.endsWith('.jpg') || file.endsWith('.png'))
      .map(file => path.join(imagesDir, file));

    const imageSummaries = await summarizeReferenceImages(imagePaths);

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert in creating innovative yet clean ad requests based on brand information, user prompts, and reference images. Generate a company profile and ad features that align with the brand's aesthetic while ensuring brand recognition."
        },
        {
          role: "user",
          content: `Create a structured ad request with a company profile and ad features based on the following information:
          Brand Information: ${brandInfo}
          User Prompt: ${userPrompt}
          Include Faces: ${includeFaces}
          Include Brand Logo: ${includeBrandLogo}
          Include Hands/Fingers: ${includeHandsFingers}
          Reference Image Summaries:
          ${imageSummaries}
          
          Use the reference image summaries as creative inspiration, not as direct instructions. Consider the emotions, themes, and abstract concepts they evoke, and use these to inform your ad features in a way that aligns with the brand's aesthetic.
          
          IMPORTANT REQUIREMENTS:
          1. The brand logo MUST be included in the ad. Incorporate it in a way that feels natural and integral to the design.
          2. Limit any text in the ad features to a maximum of 4 words.
          3. Focus on creating a clean, simple, and visually appealing ad concept that maintains strong brand identity.
          4. Keep the design elegant and not overly complex. It should fit the vibe of the brand without being gaudy or overly elaborate.
          5. Prioritize a minimalist approach that effectively communicates the brand message.
          
          Remember, the goal is to create an ad that is clean, simple, and true to the brand's aesthetic while still being impactful.`
        }
      ],
      response_format: zodResponseFormat(AdRequestSchema, "ad_request"),
    });

    const adRequest = completion.choices[0].message.parsed;
    if (!adRequest) {
      throw new Error("Failed to generate ad request");
    }
    return adRequest;
  } catch (error) {
    console.error('Error generating ad request:', error);
    throw new Error('Failed to generate ad request');
  }
}

export async function POST(request: Request) {  
  try {
    const { userPrompt, includeFaces, includeBrandLogo, includeHandsFingers } = await request.json();
    
    if (!userPrompt) {
      return NextResponse.json({ error: 'User prompt is required' }, { status: 400 });
    }

    const adRequest = await generateAdRequest(userPrompt, includeFaces, includeBrandLogo, includeHandsFingers);
    const layerPrompts = await generateLayeredAdPrompts(adRequest);
    const { layerUrls, composedUrl } = await generateAndComposeImage(layerPrompts);

    return NextResponse.json({
      layerUrls,
      composedUrl,
      generatedPrompts: layerPrompts
    });
  } catch (error) {
    console.error('Error generating ad image:', error);
    return NextResponse.json({ error: 'Failed to generate ad image' }, { status: 500 });
  }
}
