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

    const imagesDir = path.join(process.cwd(), 'public', 'refimages', 'beekeeper');
    let imageFiles: string[];
    try {
      imageFiles = await fs.readdir(imagesDir);
    } catch (error) {
      console.error('Error reading images directory:', error);
      imageFiles = [];
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const imageUrls = imageFiles
      .filter(file => file.endsWith('.jpg') || file.endsWith('.png'))
      .map(file => `${baseUrl}/refimages/beekeeper/${file}`);

    const imageSummaries = await summarizeReferenceImages(imageUrls);

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
