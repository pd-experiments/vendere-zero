import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Define a type for the variant record
interface VariantRecord {
    id: string;
    variant_id: string;
    keyword: string;
    source: string;
    search_volume: number;
    cpc: number;
    keyword_difficulty: number;
    competition_percentage: number;
    efficiency_index: number;
    confidence_score: number;
    explanation: string;
    user_id: string;
    created_at: string;
    image_url?: string;
    geo_target?: string;
    [key: string]: unknown;
}

type QueryResponse = {
    data: VariantRecord[] | null;
    error: {
        message: string;
        code: string;
    } | null;
};

export async function GET(
    request: Request,
    { params }: { params: { keyword: string } },
) {
    console.log("Variants API request received:", params);
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

        // Get the keyword from the params
        const { keyword } = params;

        if (!keyword) {
            return NextResponse.json(
                { error: "Keyword is required" },
                { status: 400 },
            );
        }

        // Decode the keyword from URL encoding
        const decodedKeyword = decodeURIComponent(keyword);
        console.log(
            `Fetching variants for keyword/id: ${decodedKeyword} for user: ${user.id}`,
        );

        // First check if this is a keyword or an ID
        // If it looks like a UUID, treat it as an ID instead of a keyword
        const isUUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                .test(decodedKeyword);

        let query;
        if (isUUID) {
            console.log(`Treating ${decodedKeyword} as a UUID/ID`);

            // First, get the image URL for this research item
            const { data: researchItem, error: researchItemError } =
                await supabase
                    .from("market_research_v2")
                    .select("image_url")
                    .eq("id", decodedKeyword)
                    .single();

            if (researchItemError) {
                console.error(
                    `Error fetching research item ${decodedKeyword}:`,
                    researchItemError,
                );

                // If not found in market_research_v2, try looking in library_items
                const { data: libraryItem, error: libraryItemError } =
                    await supabase
                        .from("library_items")
                        .select("preview_url")
                        .eq("id", decodedKeyword)
                        .single();

                if (libraryItemError) {
                    console.error(
                        `Error fetching library item ${decodedKeyword}:`,
                        libraryItemError,
                    );
                    return NextResponse.json(
                        {
                            error: "Failed to fetch item",
                            details:
                                "Item not found in either market_research_v2 or library_items",
                        },
                        { status: 404 },
                    );
                }

                // Use the library item's preview URL
                const imageUrl = libraryItem?.preview_url;

                if (!imageUrl) {
                    console.log(
                        `No image URL found for library item ${decodedKeyword}`,
                    );
                    return NextResponse.json([]);
                }

                console.log(`Looking for variants with image_url: ${imageUrl}`);

                // Get variants for this image URL
                query = supabase
                    .from("keyword_variants")
                    .select("*")
                    .eq("image_url", imageUrl)
                    .eq("user_id", user.id)
                    .order("efficiency_index", { ascending: false });
            } else {
                // Get the image URL to match against from market_research_v2
                const imageUrl = researchItem?.image_url;

                if (!imageUrl) {
                    console.log(
                        `No image URL found for research item ${decodedKeyword}`,
                    );
                    return NextResponse.json([]);
                }

                console.log(`Looking for variants with image_url: ${imageUrl}`);

                // Get variants for this image URL
                query = supabase
                    .from("keyword_variants")
                    .select("*")
                    .eq("image_url", imageUrl)
                    .eq("user_id", user.id)
                    .order("efficiency_index", { ascending: false });
            }
        } else {
            console.log(`Treating ${decodedKeyword} as a keyword`);
            // Get variants for this keyword
            query = supabase
                .from("keyword_variants")
                .select("*")
                .eq("keyword", decodedKeyword)
                .eq("user_id", user.id)
                .order("efficiency_index", { ascending: false });
        }

        // Execute the query with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Database query timeout")), 8000);
        });

        const { data, error } = await Promise.race([
            query,
            timeoutPromise,
        ]).catch((error) => {
            console.error("Error or timeout fetching variants:", error);
            throw error;
        }) as QueryResponse;

        if (error) {
            console.error(
                `Error fetching variants for ${decodedKeyword}:`,
                error,
            );
            return NextResponse.json(
                {
                    error: "Failed to fetch variants",
                    details: error.message,
                    code: error.code,
                },
                { status: 500 },
            );
        }

        // If no variants found but we're querying by ID, try a fallback
        if (isUUID && (!data || data.length === 0)) {
            console.log(
                `No variants found for research item ${decodedKeyword}, checking if any exist`,
            );

            // Try to check if we have any variants at all for this user
            const { data: anyVariants, error: anyError } = await supabase
                .from("keyword_variants")
                .select("count")
                .eq("user_id", user.id)
                .limit(1);

            if (anyError) {
                console.error("Error checking for any variants:", anyError);
            } else {
                console.log(
                    `User has ${anyVariants.length ? "some" : "no"} variants`,
                );
            }

            // Return empty array as we couldn't find variants for this item
            console.log(
                "No variants found for this research item, returning empty array",
            );
        }

        console.log(
            `Successfully fetched ${
                data?.length || 0
            } variants for ${decodedKeyword}`,
        );
        return NextResponse.json(data || []);
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        console.error(`Error in variants API for ${params.keyword}:`, error);
        return NextResponse.json(
            {
                error: "Internal Server Error",
                message: errorMessage,
                details: error instanceof Error ? error.stack : undefined,
            },
            { status: 500 },
        );
    }
}
