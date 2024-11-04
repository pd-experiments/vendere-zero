import { NextRequest, NextResponse } from "next/server";
import { spawn } from 'child_process';
import path from 'path';

type Frame = {
  timestamp: number;
  data: string;
}

type ExtractionResult = {
  success: boolean;
  frames?: Frame[];
  error?: string;
  total_duration?: number;
  frame_count?: number;
}

async function extractFramesWithPython(videoUrl: string): Promise<ExtractionResult> {
  return new Promise((resolve, reject) => {
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
        const result = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
        reject(new Error('Failed to parse Python script output', { cause: error }));
      }
    });
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { videoUrl } = body;

  if (!videoUrl) {
    return NextResponse.json(
      { error: "Video URL is required" },
      { status: 400 }
    );
  }

  try {
    console.log("Starting video frame extraction");
    const extractionResult = await extractFramesWithPython(videoUrl);
    
    if (!extractionResult.success || !extractionResult.frames) {
      throw new Error(extractionResult.error || 'Frame extraction failed');
    }
    
    console.log(`Extracted ${extractionResult.frame_count} frames from video`);
    
    // Process each frame through datagen endpoint
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = req.headers.get('host') || 'localhost:3000';
    
    const results = [];
    
    // Process frames sequentially to avoid overwhelming the system
    for (const frame of extractionResult.frames) {
      const formData = new FormData();
      
      // Convert base64 to File
      const response = await fetch(frame.data);
      const blob = await response.blob();
      const file = new File([blob], `frame_${frame.timestamp}s.jpg`, { type: 'image/jpeg' });
      formData.append('files', file);
      
      console.log(`Processing frame at ${frame.timestamp}s`);
      const frameResponse = await fetch(`${protocol}://${host}/api/datagen`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(req.headers.get('authorization') 
            ? { 'authorization': req.headers.get('authorization')! }
            : {}),
          ...(req.headers.get('cookie')
            ? { 'cookie': req.headers.get('cookie')! }
            : {})
        }
      });

      if (!frameResponse.ok) {
        console.warn(`Failed to process frame at ${frame.timestamp}s`);
        continue;
      }

      const frameResult = await frameResponse.json();
      results.push({
        timestamp: frame.timestamp,
        ...frameResult
      });
    }

    return NextResponse.json({ 
      success: true,
      total_duration: extractionResult.total_duration,
      total_frames: extractionResult.frame_count,
      results
    });
    
  } catch (error) {
    console.error("Error processing video:", error);
    return NextResponse.json(
      { error: "Failed to process video" },
      { status: 500 }
    );
  }
} 