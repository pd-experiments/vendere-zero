import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { z } from 'zod';
import { zodResponseFormat } from "openai/helpers/zod";
import { parsePDF } from '@/app/utils/pdfParser';
import { summarizeReferenceImages } from '@/app/utils/imageSummarizer';
import fs from 'fs/promises';
import path from 'path';

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

async function generateAdPrompt(request: AdRequest): Promise<string> {
  const requestString = JSON.stringify(request);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert advertising creative director. Given details about a company, specific ad requirements, and a user prompt, create a detailed and compelling prompt for DALL-E to generate an advertisement image. Pay special attention to requests for including faces, brand logos, and hands/fingers in the image."
      },
      {
        role: "user",
        content: `Generate a creative and detailed ad image prompt based on this company profile, ad features, and user prompt: ${requestString}. Be sure to explicitly mention the inclusion or exclusion of faces, brand logo, and hands/fingers as specified in the ad features.`
      }
    ],
    max_tokens: 300
  });

  return response.choices[0].message.content || "A compelling advertisement image";
}

async function generateAdRequest(userPrompt: string, includeFaces: boolean, includeBrandLogo: boolean, includeHandsFingers: boolean): Promise<AdRequest> {
  try {
    const brandInfo = await parsePDF();

    // Get reference image URLs
    const nikeImagesDir = path.join(process.cwd(), 'public', 'nike');
    const imageFiles = await fs.readdir(nikeImagesDir);
    const imageUrls = imageFiles
      .filter(file => file.endsWith('.jpg') || file.endsWith('.png'))
      .map(file => `${process.env.BASE_URL}/nike/${file}`);

    // Summarize reference images
    const imageSummaries = await summarizeReferenceImages(imageUrls);

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert in creating structured ad requests based on brand information, user prompts, and reference images. Generate a company profile and ad features based on the provided information."
        },
        {
          role: "user",
          content: `Based on the following information, create a structured ad request with a company profile and ad features:
          Brand Information: ${brandInfo}
          User Prompt: ${userPrompt}
          Include Faces: ${includeFaces}
          Include Brand Logo: ${includeBrandLogo}
          Include Hands/Fingers: ${includeHandsFingers}
          Reference Image Summaries:
          ${imageSummaries}
          
          Use the reference image summaries to inform your decisions about style, color schemes, and overall aesthetic for the ad features.`
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
    const adPrompt = await generateAdPrompt(adRequest);

    const response = await openai.images.generate({
      model: "dall-e-3",
        prompt: adPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      });

    const imageUrl = response.data[0].url;

    return NextResponse.json({ imageUrl, generatedPrompt: adPrompt });
  } catch (error) {
    console.error('Error generating ad image:', error);
    return NextResponse.json({ error: 'Failed to generate ad image' }, { status: 500 });
  }
}
