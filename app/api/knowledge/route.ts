import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.query && body.messages?.length > 0) {
      const lastUserMessage = [...body.messages].reverse().find(msg => msg.role === 'user');
      if (lastUserMessage) {
        body.query = lastUserMessage.content;
      }
    }
    
    if (!body.query) {
      throw new Error('Missing required parameter: query');
    }

    // Ensure detail level is a number between 0-100, defaulting to 50 if not provided
    const detailLevel = typeof body.detailLevel === 'number' 
      ? Math.max(0, Math.min(100, body.detailLevel)) 
      : 50;
    
    // Add detailLevel to the request body
    const requestBody = {
      ...body,
      detailLevel,
      deep_research: body.deepResearch || false,
    };
    
    const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/knowledge/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    console.log("Data", data);
    
    const formattedResponse = {
      id: Date.now().toString(),
      role: 'assistant' as const,
      content: data.response,
      sources: data.sources,
      citations: data.citations || [], // Include citations from Perplexity
      suggestedTasks: data.suggested_tasks || [], // Include suggested tasks from the API
      createdAt: new Date()
    };

    // await new Promise(resolve => setTimeout(resolve, 1500));
    
    return NextResponse.json(formattedResponse);
  } catch (error) {
    console.error('Error in knowledge query:', error);
    return NextResponse.json(
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.',
        createdAt: new Date()
      },
      { status: 500 }
    );
  }
} 