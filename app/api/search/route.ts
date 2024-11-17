import { createEmbeddings } from "@/app/api/datagen/helpers";
import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/ai";

// Update LibraryItem type to have an array of tones
type LibraryItem = {
    id: string;
    type: 'image' | 'video';
    image_url?: string;
    name?: string | null;
    video?: {
        id: string;
        name: string;
        description: string | null;
        video_url: string;
        frames: Array<{
            mapping_id: string;
            frame_id: string;
            image_url: string;
            image_description: string;
            frame_number: number;
            video_timestamp: unknown;
        }>;
    };
    image_description: string;
    features: Array<{
        keyword: string;
        confidence_score: number;
        category: string;
        location: string;
        visual_attributes?: Array<{
            attribute: string;
            value: string;
        }>;
    }>;
    sentiment_analysis: {
        tones: string[];
        confidence: number;
    };
    created_at: string;
};

type Result = LibraryItem & {
    similarity: number;
};


type SearchRPCResult = {
    id: string;
    name: string | null;
    image_url: string;
    image_description: string;
    similarity: number;
};

export async function POST(request: NextRequest) {
    try {
        const { query } = await request.json();
        
        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "Query parameter is required and must be a string" },
                { status: 400 }
            );
        }

        // Generate embeddings for the search query
        const searchEmbeddings = await createEmbeddings(query);

        // First get the basic search results
        const { data: searchResults, error } = await supabase.rpc(
            'match_ad_descriptions',
            {
                query_embedding: searchEmbeddings,
                match_threshold: 0.5,
                match_count: 5
            }
        );

        if (error) {
            console.error('Search error:', error);
            return NextResponse.json(
                { error: "Failed to perform search" },
                { status: 500 }
            );
        }

        // Fetch additional data for each result
        const enrichedResults: Result[] = await Promise.all(
            searchResults!.map(async (result: SearchRPCResult) => {
                // Get features
                const { data: features } = await supabase
                    .from('features')
                    .select(`
                        keyword,
                        confidence_score,
                        category,
                        location,
                        visual_attributes (
                            attribute,
                            value
                        )
                    `)
                    .eq('ad_output_id', result.id);

                // Get sentiment analysis
                const { data: sentiment } = await supabase
                    .from('sentiment_analysis')
                    .select('tone, confidence')
                    .eq('ad_output_id', result.id)
                    .single();

                // Transform to match LibraryItem type
                return {
                    id: result.id,
                    type: 'image' as const,
                    name: result.name,
                    image_url: result.image_url,
                    image_description: result.image_description,
                    features: features?.map(f => ({
                        keyword: f.keyword,
                        confidence_score: f.confidence_score,
                        category: f.category,
                        location: f.location,
                        visual_attributes: f.visual_attributes
                    })) || [],
                    sentiment_analysis: {
                        tones: sentiment ? [sentiment.tone] : [],
                        confidence: sentiment?.confidence || 0
                    },
                    created_at: new Date().toISOString(),
                    similarity: result.similarity
                };
            })
        );

        // Generate analysis using Groq
        const analysisPrompt = `You are an AI research assistant providing helpful, detailed answers about visual advertising content. Given this search query and results, provide a natural, conversational response that feels like a direct answer to the query while incorporating insights from the search results.

Query: "${query}"

Available Ad Data:
${enrichedResults.map((result, index) => `
[Ad ${index + 1}]
Title: ${result.name || 'Untitled'}
Description: ${result.image_description}
Relevance: ${(result.similarity * 100).toFixed(1)}% match
`).join('\n')}

Instructions:
1. Start with a direct answer to the query
2. Naturally weave in specific examples from the search results to support your points
3. Mention interesting patterns or unique findings
4. Use a conversational, helpful tone
5. Keep the response focused and concise (around 150 words)
6. Don't use phrases like "According to the search results" or "In the database"
7. Don't list out statistics directly - incorporate them naturally into your response

Format your response as a natural paragraph that flows like a direct answer to the query.`;

        const analysis = await groq.chat.completions.create({
            messages: [{ role: "user", content: analysisPrompt }],
            model: "llama-3.1-70b-versatile",
            temperature: 0.4,
            max_tokens: 300,
            top_p: 1,
            stream: false,
        });

        return NextResponse.json({ 
            results: enrichedResults,
            analysis: analysis.choices[0].message.content,
            query
        });

    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
