import { NextRequest, NextResponse } from "next/server";
import { spawn } from 'child_process';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { Groq } from 'groq-sdk';
import { z } from 'zod';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

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

async function generateVideoDescription(frameDescriptions: string[]): Promise<string> {
  const prompt = `Based on the following frame descriptions from a video, provide a concise overall description of the video content:

${frameDescriptions.join('\n')}

Provide a coherent summary in 2-3 sentences.`;

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'mixtral-8x7b-32768',
    temperature: 0.5,
    max_tokens: 200,
  });

  return completion.choices[0]?.message?.content || 'No description generated';
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

    // First, create the video entry with empty mappings array
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .insert({
        name: videoName,
        user_id: userId,
        created_at: new Date().toISOString(),
        description: null,
        video_url: videoUrl,
        mappings: [] // Initialize empty array
      })
      .select('id')
      .single();

    if (videoError) {
      console.error("Video insert error:", videoError);
      throw videoError;
    }

    if (!videoData) {
      throw new Error("Failed to create video entry");
    }

    const videoId = videoData.id;
    const mappingIds: string[] = [];
    const frameIds: string[] = [];
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.get('host') || 'localhost:3000';

    // Process all frames
    for (let index = 0; index < extractionResult.frames.length; index++) {
      const frame = extractionResult.frames[index];
      const formData = new FormData();
      
      const response = await fetch(frame.data);
      const blob = await response.blob();
      const file = new File([blob], `frame_${frame.timestamp}s.jpg`, { type: 'image/jpeg' });
      formData.append('files', file);
      
      console.log(`Processing frame ${index + 1}/${extractionResult.frames.length}`);
      
      try {
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
          console.warn(`Failed to process frame at ${frame.timestamp}s`);
          continue;
        }

        const frameResult = DatagenResultSchema.parse(await frameResponse.json());
        
        if (frameResult.results[0].status === "error") {
          console.warn(`Failed to process frame at ${frame.timestamp}s: ${frameResult.results[0].error}`);
          continue;
        }

        const frameData = frameResult.results[0];
        frameIds.push(frameData.id);

        // Create video_frames_mapping entry
        const { data: mappingData, error: mappingError } = await supabase
          .from('video_frames_mapping')
          .insert({
            video_id: videoId,
            frame_id: frameData.id,
            frame_number: index + 1,
            video_timestamp: frame.timestamp,
            user_id: userId,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (mappingError) {
          console.error("Mapping insert error:", mappingError);
          continue;
        }

        if (mappingData) {
          mappingIds.push(mappingData.id);
        }
      } catch (frameError) {
        console.error(`Error processing frame ${index + 1}:`, frameError);
        continue;
      }
    }

    // Update video with all mapping IDs
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

    // Fetch all frame descriptions for the video summary
    const { data: frames, error: framesError } = await supabase
      .from('ad_structured_output')
      .select('image_description')
      .in('id', frameIds);

    if (framesError) throw framesError;

    const descriptions = frames?.map(f => f.image_description) || [];

    // Generate overall video description
    const videoDescription = descriptions.length > 0 
      ? await generateVideoDescription(descriptions)
      : 'No description available';

    // Update video with description
    const { error: updateError } = await supabase
      .from('videos')
      .update({ description: videoDescription })
      .eq('id', videoId);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true,
      videoId: videoId,
      total_duration: extractionResult.total_duration,
      total_frames: extractionResult.frame_count,
      description: videoDescription
    });
    
  } catch (error) {
    console.error("Error processing video:", error);
    return NextResponse.json(
      { error: "Failed to process video", details: error },
      { status: 500 }
    );
  }
} 