import { NextResponse } from 'next/server';
import { openai } from '@/lib/ai';
import { z } from 'zod';
import { zodResponseFormat } from "openai/helpers/zod";
import { parsePDF } from '@/app/utils/pdfParser';
import { summarizeReferenceImages } from '@/app/utils/imageSummarizer';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';

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
  brandStyle: z.string(),
  colorScheme: z.string(),
  brandLogoProminence: z.number(),
  additionalElements: z.array(z.string()).optional(),
});

const AdRequestSchema = z.object({
  companyProfile: CompanyProfileSchema,
  adFeatures: AdFeaturesSchema,
  userPrompt: z.string(), 
});

type AdRequest = z.infer<typeof AdRequestSchema>;

// async function generateAdPrompt(request: AdRequest): Promise<string> {
//   const requestString = JSON.stringify(request);
//   const response = await openai.chat.completions.create({
//     model: "gpt-4o",
//     messages: [
//       {
//         role: "system",
//         content: "You are an expert advertising creative director. Given details about a company, specific ad requirements, and a user prompt, create a detailed and compelling prompt for DALL-E to generate an advertisement image. Pay special attention to requests for including faces, brand logos, and hands/fingers in the image."
//       },
//       {
//         role: "user",
//         content: `Generate a creative and detailed ad image prompt based on this company profile, ad features, and user prompt: ${requestString}. Be sure to explicitly mention the inclusion or exclusion of faces, brand logo, and hands/fingers as specified in the ad features.`
//       }
//     ],
//     max_tokens: 300
//   });

//   return response.choices[0].message.content || "A compelling advertisement image";
// }

async function generateAdPrompt(request: AdRequest): Promise<string> {
  const requestString = JSON.stringify(request);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert advertising creative director. Given details about a company, specific ad requirements, and a user prompt, create a detailed and compelling prompt for DALL-E to generate an image that can be used as the background or main visual element for an advertisement. Focus on describing a scene or visual concept that aligns with the brand's message and ad requirements, rather than asking for a complete ad creative."
      },
      {
        role: "user",
        content: `Generate a detailed image prompt based on this company profile, ad features, and user prompt: ${requestString}. 

        Guidelines:
        1. Describe a specific scene, background, or visual concept that aligns with the brand's message and industry.
        2. Don't mention creating an "ad" or "advertisement" in the prompt.
        3. Focus on the visual elements, mood, and style that reflect the brand's personality and ad goals.
        4. If text is required, limit it to the specific words or phrase mentioned in the ad features.
        5. Be explicit about including or excluding faces, brand logo, and hands/fingers as specified in the ad features.
        6. Ensure the description allows for the brand logo to be added later if required.
        7. Aim for a clean, simple, and visually appealing concept that maintains strong brand identity.

        Example: Instead of "Create an ad for a frontline success platform", say something like "Design a modern, sleek office space with employees collaborating, symbolizing efficiency and teamwork. Include a clean area where text can be overlaid."
        `
      }
    ],
    max_tokens: 300
  });

  return response.choices[0].message.content || "A compelling visual scene for an advertisement";
}

async function generateAdRequest(
  userPrompt: string, 
  includeFaces: boolean, 
  includeBrandLogo: boolean, 
  includeHandsFingers: boolean,
  brandStyle: string,
  colorScheme: string,
  brandLogoProminence: number
): Promise<AdRequest> {
  try {
    const brandInfo = await parsePDF();

    const imagesDir = path.join(process.cwd(), 'refimages', 'beekeeper');
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
          Brand Style: ${brandStyle}
          Color Scheme: ${colorScheme}
          Brand Logo Prominence: ${brandLogoProminence}
          Reference Image Summaries:
          ${imageSummaries}
                  
          Use the reference image summaries as creative inspiration, not as direct instructions. Consider the emotions, themes, and abstract concepts they evoke, and use these to inform your ad features in a way that aligns with the brand's aesthetic.
                  
          IMPORTANT REQUIREMENTS:
          1. The brand logo MUST be included in the ad. Incorporate it in a way that feels natural and integral to the design, with prominence level of ${brandLogoProminence} (0-100 scale).
          2. Limit any text in the ad features to a maximum of 4 words.
          3. Focus on creating a clean, simple, and visually appealing ad concept that maintains strong brand identity.
           4. Keep the design elegant and not overly complex. It should fit the vibe of the brand without being gaudy or overly elaborate.
          5. Prioritize a minimalist approach that effectively communicates the brand message.
          6. Ensure the ad aligns with the specified brand style (${brandStyle}) and color scheme (${colorScheme}).
                  
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

async function generateImageWithStabilityAI(prompt: string): Promise<Buffer> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error('STABILITY_API_KEY is not set in the environment variables');
  }

  const payload = {
    prompt: prompt,
    output_format: "png"
  };

  try {
    const response = await axios.postForm(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      axios.toFormData(payload, new FormData()),
      {
        validateStatus: undefined,
        responseType: "arraybuffer",
        headers: { 
          Authorization: `Bearer ${apiKey}`, 
          Accept: "image/*" 
        },
      }
    );

    if (response.status === 200) {
      return Buffer.from(response.data);
    } else {
      throw new Error(`${response.status}: ${response.data.toString()}`);
    }
  } catch (error) {
    console.error('Stability AI API error:', error);
    throw new Error(`Stability AI API error: ${error}`);
  }
}

export async function POST(request: Request) {  
  try {
    const { 
      userPrompt, 
      includeFaces, 
      includeBrandLogo, 
      includeHandsFingers,
      brandStyle,
      colorScheme,
      brandLogoProminence
    } = await request.json();
    
    if (!userPrompt) {
      return NextResponse.json({ error: 'User prompt is required' }, { status: 400 });
    }

    try {
      console.log("Generating ad request...")
      const adRequest = await generateAdRequest(
        userPrompt, 
        includeFaces, 
        includeBrandLogo, 
        includeHandsFingers,
        brandStyle,
        colorScheme,
        brandLogoProminence
      );
      console.log("Generating ad prompt...")
      const adPrompt = await generateAdPrompt(adRequest);
      console.log("Generating image with Stability AI...")
      const imageBuffer = await generateImageWithStabilityAI(adPrompt);

      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': 'inline; filename="generated_image.png"'
        }
      });
    } catch (error) {
      console.error('Error in image generation process:', error);
      return NextResponse.json({ 
        error: 'Failed to generate image', 
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in POST request:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
