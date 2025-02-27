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

    // // Simple response without streaming
    // const response = {
    //   id: Date.now().toString(),
    //   role: 'assistant',
    //   content: "Here is a detailed analysis based on the available data...",
    //   createdAt: new Date(),
    //   sources: [
    //     {
    //       id: "source-1",
    //       text: "This is a sample source from market research data showing consumer preferences.",
    //       score: 0.92,
    //       extra_info: {
    //         type: "market_research",
    //         id: "mr-123",
    //         image_url: "https://via.placeholder.com/150"
    //       }
    //     },
    //     {
    //       id: "source-2",
    //       text: "This is a sample source from ad data showing campaign performance.",
    //       score: 0.85,
    //       extra_info: {
    //         type: "ad",
    //         id: "ad-456",
    //         image_url: "https://via.placeholder.com/150"
    //       }
    //     },
    //     {
    //       id: "source-3",
    //       text: "This is a sample source from citation data showing competitor analysis.",
    //       score: 0.78,
    //       extra_info: {
    //         type: "citation",
    //         id: "cit-789",
    //         url: "https://example.com",
    //         image_url: "https://via.placeholder.com/150"
    //       }
    //     }
    //   ]
    // };
    
    const response = await fetch(process.env.NEXT_PUBLIC_API_URL + '/knowledge/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log("Data", data);
    
    const formattedResponse = {
      id: Date.now().toString(),
      role: 'assistant' as const,
      content: data.response,
      sources: data.sources,
      citations: data.citations || [], // Include citations from Perplexity
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