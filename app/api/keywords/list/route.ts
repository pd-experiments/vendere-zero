import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Define types for the RPC response
type RPCItem = {
    mr_id?: string;
    mr_user_id?: string;
    mr_image_url?: string;
    mr_created_at?: string;
    mr_intent_summary?: string;
    mr_target_audience?: Record<string, unknown>;
    mr_pain_points?: Record<string, unknown>;
    mr_buying_stage?: string;
    mr_key_features?: Record<string, unknown>;
    mr_competitive_advantages?: Record<string, unknown>;
    mr_perplexity_insights?: string;
    mr_citations?: string[];
    mr_keywords?: Array<string | Record<string, unknown>>;
    mr_original_headlines?: Array<Record<string, unknown>>;
    mr_new_headlines?: Array<Record<string, unknown>>;
    li_id?: string;
    li_type?: string;
    li_name?: string;
    li_description?: string;
    li_user_id?: string;
    li_created_at?: string;
    li_item_id?: string;
    li_features?: string[];
    li_sentiment_tones?: string[];
    li_avg_sentiment_confidence?: number;
    li_preview_url?: string;
    [key: string]: unknown; // Allow for any additional properties
};

// Define the transformed item type
type TransformedItem = {
    id: string;
    title: string;
    keyword: string | null;
    description: string;
    intent_summary: string;
    created_at: string | undefined;
    mr_id?: string;
    li_id?: string;
    image_url?: string;
    preview_url?: string;
    variant_count: number;
};

export async function GET() {
    const cookieStore = cookies();

    // Create a Supabase client with service role key for higher privileges
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        },
    );

    try {
        // Get the current user
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        // Call the RPC function to join market research and library items
        const { data, error } = await supabase
            .rpc("join_market_research_and_library_items");

        if (error) {
            console.error("Error fetching research items:", error);
            return NextResponse.json(
                { error: "Failed to fetch research items" },
                { status: 500 },
            );
        }

        // Transform the data to match the expected structure in the React component
        const transformedData = data.map((item: RPCItem) => {
            // Extract keywords from mr_keywords if available
            let keyword = null;
            if (item.mr_keywords && item.mr_keywords.length > 0) {
                // Assuming the first keyword is the main one
                const firstKeyword = item.mr_keywords[0];
                if (
                    typeof firstKeyword === "object" &&
                    "keyword" in firstKeyword && firstKeyword.keyword
                ) {
                    keyword = String(firstKeyword.keyword);
                } else if (typeof firstKeyword === "string") {
                    keyword = firstKeyword;
                }
            }

            return {
                id: item.mr_id || item.li_id || "",
                title: item.li_name || "Untitled",
                keyword: keyword,
                description: item.li_description || "",
                intent_summary: item.mr_intent_summary || "",
                created_at: item.mr_created_at || item.li_created_at,
                // Keep other fields that might be useful
                mr_id: item.mr_id,
                li_id: item.li_id,
                image_url: item.mr_image_url,
                preview_url: item.li_preview_url,
                variant_count: 0, // Will be updated in the next step
            } as TransformedItem;
        });

        // For each item, get the count of keyword variants
        for (const item of transformedData) {
            if (item.keyword) {
                // Get count of variants for this keyword
                const { count, error: countError } = await supabase
                    .from("keyword_variants")
                    .select("*", { count: "exact", head: false })
                    .eq("keyword", item.keyword);

                if (countError) {
                    console.error(
                        `Error counting variants for ${item.keyword}:`,
                        countError,
                    );
                    item.variant_count = 0;
                } else {
                    item.variant_count = count || 0;
                }
            } else {
                item.variant_count = 0;
            }
        }

        return NextResponse.json(transformedData);
    } catch (error) {
        console.error("Error in research items API:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
