import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from "openai/helpers/zod";
import { parsePDF } from '@/app/utils/pdfParser';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  additionalElements: z.array(z.string()).optional(),
});

const AdRequestSchema = z.object({
  companyProfile: CompanyProfileSchema,
  adFeatures: AdFeaturesSchema,
});

type AdRequest = z.infer<typeof AdRequestSchema>;

async function generateAdPrompt(request: AdRequest): Promise<string> {
  const requestString = JSON.stringify(request);
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert advertising creative director. Given details about a company and specific ad requirements, create a detailed and compelling prompt for DALL-E to generate an advertisement image."
      },
      {
        role: "user",
        content: `Generate a creative and detailed ad image prompt based on this company profile and ad features: ${requestString}`
      }
    ],
    max_tokens: 200
  });

  return response.choices[0].message.content || "A compelling advertisement image";
}

async function generateAdRequest(): Promise<AdRequest> {
  try {
    const brandInfo = await parsePDF();

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert in creating structured ad requests based on brand information. Generate a company profile and ad features based on the provided brand information."
        },
        {
          role: "user",
          content: `Based on the following brand information, create a structured ad request with a company profile and ad features: ${brandInfo}`
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

export async function POST() {  
  try {
    const adRequest = await generateAdRequest();
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
