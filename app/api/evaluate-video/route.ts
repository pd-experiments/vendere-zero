import { NextRequest, NextResponse } from "next/server";
import { spawn } from 'child_process';
import path from 'path';
import { supabase } from '@/lib/supabase';
// import { Groq } from 'groq-sdk';
import { z } from 'zod';
import { Tables } from '@/lib/types/schema';
import { openai } from '@/lib/ai';
import { zodResponseFormat } from 'openai/helpers/zod';

// const groq = new Groq({
//   apiKey: process.env.GROQ_API_KEY
// });

// Zod schemas
const FrameSchema = z.object({
  timestamp: z.number(),
  data: z.string()
});

const ExtractionResultSchema = z.object({
  success: z.boolean(),
  frames: z.array(FrameSchema).optional(),
  error: z.string().optional(),
  total_duration: z.number().optional(),
  frame_count: z.number().optional()
});

const DatagenResultSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    imageUrl: z.string(),
    status: z.enum(["success", "error"]),
    error: z.string().optional()
  }))
});

const RequestBodySchema = z.object({
  videoUrl: z.string().url(),
  videoName: z.string(),
  userId: z.string().uuid().nullable()
});

const VideoDescriptionSchema = z.object({
  name: z.string(),
  description: z.string()
});

async function generateVideoDescription(frameDescriptions: string[]): Promise<z.infer<typeof VideoDescriptionSchema>> {
  const prompt = `Based on the following frame descriptions from a video, generate a structured output containing:
1. A short, memorable name (3-4 words) for the video that captures its essence
2. A concise overall description of the video content in 2-3 sentences

Frame descriptions:
${frameDescriptions.join('\n')}`;

  const response = await openai.beta.chat.completions.parse({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    model: "gpt-4o-mini",
    response_format: zodResponseFormat(VideoDescriptionSchema, "video_description"),
  });

  // const completion = await groq.chat.completions.create({
  //   messages: [{ role: 'user', content: prompt }],
  //   model: 'mixtral-8x7b-32768',
  //   temperature: 0.5,
  //   max_tokens: 200,
  // });

  const result = response.choices[0].message.parsed;
  
  if (!result) {
    return {
      name: "Untitled Video",
      description: "No description available"
    };
  }

  return result;
}

async function extractFramesWithPython(videoUrl: string) {
  return new Promise<z.infer<typeof ExtractionResultSchema>>((resolve, reject) => {
    // Path to Python script (relative to project root)
    const scriptPath = path.join(process.cwd(), 'scripts', 'extract_frames.py');
    
    // Use system Python directly
    const pythonProcess = spawn('python3', [scriptPath, videoUrl]);
    
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error('Python stderr:', errorData);
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', errorData);
        reject(new Error(`Python script failed with code ${code}: ${errorData}`));
        return;
      }

      try {
        const result = ExtractionResultSchema.parse(JSON.parse(outputData));
        resolve(result);
      } catch (error) {
        reject(new Error('Failed to parse Python script output', { cause: error }));
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrl, videoName, userId } = RequestBodySchema.parse(body);

    console.log("Starting video frame extraction");
    const extractionResult = await extractFramesWithPython(videoUrl);
    
    if (!extractionResult.success || !extractionResult.frames) {
      throw new Error(extractionResult.error || 'Frame extraction failed');
    }

    // Create video entry first
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .insert({
        name: videoName,
        user_id: userId,
        created_at: new Date().toISOString(),
        description: null,
        video_url: videoUrl,
        mappings: []
      })
      .select('id')
      .single<Pick<Tables<'videos'>, 'id'>>();

    if (videoError || !videoData) {
      console.error("Video insert error:", videoError);
      throw videoError || new Error("Failed to create video entry");
    }

    const videoId = videoData.id;
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.get('host') || 'localhost:3000';

    // Prepare all frames for batch processing
    const formData = new FormData();
    const frameMetadata: Array<{ timestamp: number, index: number }> = [];

    // Add all frames to formData and track their metadata
    for (let index = 0; index < extractionResult.frames.length; index++) {
      const frame = extractionResult.frames[index];
      const response = await fetch(frame.data);
      const blob = await response.blob();
      const file = new File([blob], `frame_${index}.jpg`, { type: 'image/jpeg' });
      formData.append('files', file);
      frameMetadata.push({ timestamp: frame.timestamp, index });
    }

    // Process all frames in one batch
    console.log(`Processing ${extractionResult.frames.length} frames in batch`);
    const frameResponse = await fetch(`${protocol}://${host}/api/datagen`, {
      method: 'POST',
      body: formData,
      headers: {
        ...(req.headers.get('authorization') 
          ? { 'authorization': req.headers.get('authorization') as string }
          : {}),
        ...(req.headers.get('cookie')
          ? { 'cookie': req.headers.get('cookie') as string }
          : {})
      }
    });

    if (!frameResponse.ok) {
      throw new Error('Failed to process frames batch');
    }

    const frameResults = DatagenResultSchema.parse(await frameResponse.json());
    
    // Create mappings for successfully processed frames
    const mappingPromises = frameResults.results
      .filter(result => result.status === "success")
      .map(async (frameResult, arrayIndex) => {
        const metadata = frameMetadata[arrayIndex];
        
        const { data: mappingData, error: mappingError } = await supabase
          .from('video_frames_mapping')
          .insert({
            video_id: videoId,
            frame_id: frameResult.id,
            frame_number: metadata.index + 1,
            video_timestamp: metadata.timestamp,
            user_id: userId,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single<Pick<Tables<'video_frames_mapping'>, 'id'>>();

        if (mappingError) {
          console.error("Mapping insert error:", mappingError);
          return null;
        }

        return mappingData?.id;
      });

    // Wait for all mappings to be created
    const mappingIds = (await Promise.all(mappingPromises)).filter(Boolean) as string[];
    const frameIds = frameResults.results
      .filter(result => result.status === "success")
      .map(result => result.id);

    // Update video with mapping IDs
    if (mappingIds.length > 0) {
      const { error: updateError } = await supabase
        .from('videos')
        .update({ mappings: mappingIds })
        .eq('id', videoId);

      if (updateError) {
        console.error("Failed to update video mappings:", updateError);
        throw updateError;
      }
    }

    // Get frame descriptions and generate video description
    const { data: frames, error: framesError } = await supabase
      .from('ad_structured_output')
      .select('image_description')
      .in('id', frameIds)
      .returns<Pick<Tables<'ad_structured_output'>, 'image_description'>[]>();

    if (framesError) throw framesError;

    const descriptions = frames?.map(f => f.image_description) || [];
    const videoAnalysis = descriptions.length > 0 
      ? await generateVideoDescription(descriptions)
      : { name: "Untitled Video", description: "No description available" };

    // Update video with description and name
    const { error: updateError } = await supabase
      .from('videos')
      .update({ 
        description: videoAnalysis.description,
        name: videoAnalysis.name 
      })
      .eq('id', videoId);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true,
      videoId: videoId,
      total_duration: extractionResult.total_duration,
      total_frames: extractionResult.frame_count,
      description: videoAnalysis.description,
      name: videoAnalysis.name
    });
    
  } catch (error) {
    console.error("Error processing video:", error);
    return NextResponse.json(
      { error: "Failed to process video", details: error },
      { status: 500 }
    );
  }
} 