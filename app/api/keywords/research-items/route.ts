import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Define types for the RPC response
interface RPCItem {
    mr_id: string;
    mr_user_id: string;
    mr_image_url?: string;
    mr_created_at?: string;
    mr_intent_summary?: string;
    mr_keywords?: (string | Record<string, unknown>)[];
    li_id?: string;
    li_name?: string;
    li_description?: string;
    li_preview_url?: string;
    li_user_id?: string;
    li_created_at?: string;
    // Note: The RPC doesn't return image_url directly, it returns mr_image_url and li_preview_url
}

// Define type for transformed items
interface TransformedItem {
    id: string;
    title: string;
    description: string;
    keywords: string[];
    image_url: string | null;
    mr_image_url: string | null; // Added to maintain both fields
    li_preview_url: string | null; // Added to maintain both fields
    source: string;
    created_at: string;
    intent_summary: string | null;
    user_id: string;
    variant_count: number;
}

export async function GET() {
    try {
        console.log("Fetching research items...");
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            },
        );

        // Get all research items using the RPC function
        const { data: researchItems, error: rpcError } = await supabase.rpc(
            "join_market_research_and_library_items",
        );

        if (rpcError) {
            console.error("Error fetching research items:", rpcError);
            return NextResponse.json(
                { error: "Error fetching research items", details: rpcError },
                { status: 500 },
            );
        }

        console.log(`Retrieved ${researchItems.length} research items`);

        // Transform the data
        const transformedItems: TransformedItem[] = researchItems.map(
            (item: RPCItem) => {
                // Use the best available title
                const title = item.li_name || "Untitled";

                // Use the best available description
                const description = item.li_description || "";

                // Extract keywords from mr_keywords JSONB array if available
                const keywords = Array.isArray(item.mr_keywords)
                    ? item.mr_keywords.map((k) =>
                        typeof k === "string" ? k : String(k)
                    )
                    : [];

                // Store both image URLs for maximum compatibility
                const mr_image_url = item.mr_image_url || null;
                const li_preview_url = item.li_preview_url || null;

                // Primary image URL for matching with variants
                // NOTE: This should match what's used in the variant endpoint
                const image_url = mr_image_url || li_preview_url || null;

                // Use the best available source
                const source = "Research Item";

                // Use the best available creation date
                const created_at = item.mr_created_at || item.li_created_at ||
                    new Date().toISOString();

                // Use the best available intent summary
                const intent_summary = item.mr_intent_summary || null;

                return {
                    id: item.mr_id, // Use market research ID as the primary ID
                    title,
                    description,
                    keywords,
                    image_url,
                    mr_image_url, // Keep both original fields
                    li_preview_url, // Keep both original fields
                    source,
                    created_at,
                    intent_summary,
                    user_id: item.mr_user_id || item.li_user_id,
                    // Initialize variant_count to 0, will be updated later
                    variant_count: 0,
                };
            },
        );

        // Get user ID for fetching variants
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("Error getting user:", userError);
            return NextResponse.json(
                { error: "Error getting user", details: userError },
                { status: 401 },
            );
        }

        // OPTIMIZATION: Instead of querying variants for each image URL individually,
        // fetch all variants for this user in a single query
        const { data: allVariants, error: variantError } = await supabase
            .from("keyword_variants")
            .select("variant_id, image_url")
            .eq("user_id", user.id);

        if (variantError) {
            console.error("Error fetching variants:", variantError);
            // Continue with zero counts rather than failing completely
        } else if (allVariants && allVariants.length > 0) {
            console.log(
                `Retrieved ${allVariants.length} variants for matching`,
            );

            // Count variants by image_url in memory
            const variantCountsByImageUrl: Record<string, number> = {};

            allVariants.forEach((variant) => {
                if (variant.image_url) {
                    variantCountsByImageUrl[variant.image_url] =
                        (variantCountsByImageUrl[variant.image_url] || 0) + 1;
                }
            });

            // Update counts in transformed items
            transformedItems.forEach((item) => {
                if (item.image_url && variantCountsByImageUrl[item.image_url]) {
                    item.variant_count =
                        variantCountsByImageUrl[item.image_url];
                }
            });
        }

        console.log("Returning research items with variant counts");
        return NextResponse.json(transformedItems);
    } catch (error) {
        console.error("Unexpected error in GET route:", error);
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        return NextResponse.json(
            { error: "Unexpected error", details: errorMessage },
            { status: 500 },
        );
    }
}
