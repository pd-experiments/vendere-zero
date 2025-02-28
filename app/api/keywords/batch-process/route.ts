import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Process a batch of items to generate variants, ensuring each item's image URL
 * is properly set to link generated variants to the correct research item.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Extract data from request
        const { item_ids } = body;

        if (!Array.isArray(item_ids) || item_ids.length === 0) {
            return NextResponse.json(
                { error: "Missing or invalid item_ids parameter" },
                { status: 400 },
            );
        }

        console.log(
            `Processing ${item_ids.length} items for variant generation`,
        );

        // Create a Supabase client
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

        // Get all research items using the RPC function to ensure we have the correct image URLs
        const { data: allItems, error: rpcError } = await supabase.rpc(
            "join_market_research_and_library_items",
        );

        if (rpcError) {
            console.error("Error fetching research items:", rpcError);
            return NextResponse.json(
                { error: "Error fetching research items", details: rpcError },
                { status: 500 },
            );
        }

        // Filter only the items we need
        const selectedItems = allItems.filter((
            item: { mr_id?: string; li_id?: string },
        ) => item_ids.includes(item.mr_id || ""));

        if (selectedItems.length === 0) {
            return NextResponse.json(
                { error: "No matching items found" },
                { status: 404 },
            );
        }

        console.log(`Found ${selectedItems.length} items to process`);

        // Prepare batch to process
        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            details: [] as Array<{
                item_id: string;
                status: string;
                message: string;
                variant_count?: number;
            }>,
        };

        // Process each item
        for (const item of selectedItems) {
            try {
                results.processed++;

                // Extract the image URL - critical for matching variants to items
                const imageUrl = item.mr_image_url || item.li_preview_url;
                if (!imageUrl) {
                    throw new Error("No image URL available for item");
                }

                // Prepare the ad features data
                const adFeatures = {
                    visual_cues: Array.isArray(item.mr_keywords)
                        ? item.mr_keywords.slice(0, 5).map((k) =>
                            typeof k === "string" ? k : String(k)
                        )
                        : ["product"],
                    pain_points: ["problem", "challenge", "need"],
                    visitor_intent: "learn",
                    product_category: "general",
                    campaign_objective: "awareness",
                    // Set the image URL to ensure variants are linked to this item
                    image_url: imageUrl,
                };

                console.log(
                    `Generating variants for item ${item.mr_id} with image URL: ${imageUrl}`,
                );

                // Call the Python API to generate the variants
                const pythonApiUrl = process.env.PYTHON_API_URL ||
                    "http://localhost:8000";
                const response = await fetch(
                    `${pythonApiUrl}/keywords/generate`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            ad_features: adFeatures,
                            user_id: user.id,
                            image_url: imageUrl,
                        }),
                    },
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `Python API error (${response.status}): ${errorText}`,
                    );
                }

                const variantResult = await response.json();
                console.log(
                    `Generated ${variantResult.length} variants for item ${item.mr_id}`,
                );

                // Update the variant_count for this item in the database
                await supabase
                    .from("market_research_v2")
                    .update({ variant_count: variantResult.length })
                    .eq("id", item.mr_id);

                results.successful++;
                results.details.push({
                    item_id: item.mr_id,
                    status: "success",
                    message: `Generated ${variantResult.length} variants`,
                    variant_count: variantResult.length,
                });
            } catch (error) {
                console.error(`Error processing item ${item.mr_id}:`, error);
                results.failed++;
                results.details.push({
                    item_id: item.mr_id,
                    status: "failed",
                    message: error instanceof Error
                        ? error.message
                        : "Unknown error",
                });
            }
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error("Error in batch-process API:", error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: error instanceof Error
                    ? error.message
                    : "Unknown error",
            },
            { status: 500 },
        );
    }
}
