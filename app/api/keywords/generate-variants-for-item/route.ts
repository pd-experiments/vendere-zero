import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Define the AdFeatures interface to match what's expected by the API
interface AdFeatures {
    visual_cues: string[];
    pain_points: string[];
    visitor_intent: string;
    product_category?: string;
    campaign_objective?: string;
    image_url?: string | null;
    [key: string]: unknown;
}

// Define the expected request body
interface RequestBody {
    item_id: string;
    ad_features: AdFeatures;
}

export async function POST(request: Request) {
    try {
        // Parse the request body
        const requestBody: RequestBody = await request.json();
        const { item_id, ad_features } = requestBody;

        if (!item_id) {
            return NextResponse.json(
                { error: "item_id is required" },
                { status: 400 },
            );
        }

        console.log(`Generating variants for item_id: ${item_id}`);

        const cookieStore = cookies();

        // Create a Supabase client
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

        // Prepare the API request to the Python backend
        const pythonApiUrl = process.env.PYTHON_API_URL ||
            "http://localhost:8000";

        // Fetch the item from the database to get additional details
        const { data: itemData, error: itemError } = await supabase
            .from("market_research_v2")
            .select("*")
            .eq("id", item_id)
            .single();

        if (itemError) {
            console.error(`Error fetching item ${item_id}:`, itemError);
            return NextResponse.json(
                { error: `Failed to fetch item: ${itemError.message}` },
                { status: 500 },
            );
        }

        // Also get the library item if it exists (it should be joined by image URL)
        const { data: libraryItemData, error: libraryItemError } =
            await supabase
                .from("library_items")
                .select("*")
                .eq("preview_url", itemData.image_url)
                .maybeSingle();

        if (libraryItemError) {
            console.log(
                `Error fetching library item for ${item_id}:`,
                libraryItemError,
            );
            // Non-critical error, continue with market research item only
        }

        // Get the image URL to use for linking variants to this item
        const imageUrl = itemData.image_url ||
            (libraryItemData ? libraryItemData.preview_url : null) ||
            ad_features.image_url;

        if (!imageUrl) {
            console.warn(
                `No image URL available for item ${item_id}. Using placeholder.`,
            );
        } else {
            console.log(`Using image URL for variants: ${imageUrl}`);
        }

        // Enrich the ad features with item data
        const enrichedAdFeatures: AdFeatures = {
            ...ad_features,
            // Add more from item data if needed
            visual_cues: [
                ...ad_features.visual_cues,
                ...(Array.isArray(itemData.keywords)
                    ? itemData.keywords.slice(0, 5)
                    : []),
            ],
            target_audience: itemData.target_audience || {},
            // Always use the item's image URL to ensure matching
            image_url: imageUrl || "placeholder-image-url.jpg",
        };

        // Call the Python API to generate the variants
        console.log(
            `Calling Python API to generate variants for item_id: ${item_id} with image_url: ${enrichedAdFeatures.image_url}`,
        );
        const response = await fetch(`${pythonApiUrl}/keywords/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ad_features: enrichedAdFeatures,
                user_id: user.id,
                // Don't need to pass item_id anymore, as we're using image_url
                image_url: enrichedAdFeatures.image_url,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Python API error (${response.status}):`, errorText);
            return NextResponse.json(
                { error: `Python API error: ${errorText}` },
                { status: response.status },
            );
        }

        const generatedVariants = await response.json();
        console.log(
            `Generated ${generatedVariants.length} variants for item_id: ${item_id} with image_url: ${enrichedAdFeatures.image_url}`,
        );

        // Check if any of the generated variants do not have the image_url set
        if (
            generatedVariants.length > 0 &&
            generatedVariants.some((v: { image_url?: string }) => !v.image_url)
        ) {
            console.warn(
                `Some variants are missing image_url. This may cause them to not be associated with the item.`,
            );
        }

        // Now update the variant_count for this item in the database
        const { error: updateError } = await supabase
            .from("market_research")
            .update({ variant_count: generatedVariants.length })
            .eq("id", item_id);

        if (updateError) {
            console.error(
                `Error updating variant count for item ${item_id}:`,
                updateError,
            );
        }

        return NextResponse.json({
            success: true,
            item_id,
            variant_count: generatedVariants.length,
            image_url: enrichedAdFeatures.image_url,
            message:
                `Successfully generated ${generatedVariants.length} variants for item ${item_id}`,
        });
    } catch (error) {
        console.error("Error in generate-variants-for-item API:", error);
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
