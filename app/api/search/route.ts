import { createEmbeddings } from "@/app/api/datagen/helpers";
import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/ai";
import { cookies } from "next/headers";
import { createServerClient } from '@supabase/ssr';

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

    const cookieStore = cookies();
        
    // Create server-side Supabase client with cookie auth
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );
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

        console.log("searchEmbeddings", searchEmbeddings);
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // First get the basic search results
        const { data: searchResults, error } = await supabase.rpc(
            'match_ad_descriptions',
            {
                query_embedding: searchEmbeddings,
                match_threshold: 0.5,
                match_count: 5,
                user_id: user.id
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
                // Get the library item which already contains features and sentiment
                const { data: libraryItem } = await supabase
                    .from('library_items')
                    .select('*')
                    .eq('id', result.id)
                    .single();

                // Transform to match LibraryItem type
                return {
                    id: result.id,
                    type: 'image' as const,
                    name: result.name,
                    image_url: result.image_url,
                    image_description: result.image_description,
                    features: libraryItem?.features?.map((feature: string) => {
                        const [keyword, category, location, confidence] = feature.split('|');
                        return {
                            keyword,
                            category,
                            location,
                            confidence_score: parseFloat(confidence),
                            visual_attributes: [] // Visual attributes are not stored in the new format
                        };
                    }) || [],
                    sentiment_analysis: {
                        tones: libraryItem?.sentiment_tones || [],
                        confidence: libraryItem?.avg_sentiment_confidence || 0
                    },
                    created_at: libraryItem?.created_at || new Date().toISOString(),
                    similarity: result.similarity
                };
            })
        );

        // Generate analysis using Groq
        const analysisPrompt = `You are an AI assistant helping users understand their visual ad search results. Your only purpose is to explain what was found in the search results for their query.

        Query: "${query}"
        
        ${enrichedResults.length === 0 ? 
            "No matching results were found for this query." : 
            `Found ${enrichedResults.length} relevant results:
        ${enrichedResults.map((result, index) => `
        [Ad ${index + 1}]
        Title: ${result.name || 'Untitled'}
        Description: ${result.image_description}
        Relevance: ${(result.similarity * 100).toFixed(1)}% match
        `).join('\n')}
        
        Explain these results in a natural way, focusing on:
        1. How well they match the search query
        2. Common visual themes or patterns
        3. Notable differences between results
        4. Most relevant features for the query
        
        Keep your response concise (around 100 words) and conversational.`}`;

        const analysis = await groq.chat.completions.create({
            messages: [{ role: "user", content: analysisPrompt }],
            model: "llama-3.3-70b-versatile",
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
