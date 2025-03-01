import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
    try {
        console.log(
            "Starting migration to update item_id for existing keyword variants",
        );
        const cookieStore = cookies();

        // Create a Supabase client with service role key for admin operations
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            },
        );

        // 1. First, get all keyword variants without item_id
        const { data: variantsWithoutItemId, error: variantsError } =
            await supabase
                .from("keyword_variants")
                .select("variant_id, keyword, user_id")
                .is("item_id", null);

        if (variantsError) {
            console.error(
                "Error fetching variants without item_id:",
                variantsError,
            );
            return NextResponse.json({
                success: false,
                error: variantsError.message,
            }, { status: 500 });
        }

        if (!variantsWithoutItemId || variantsWithoutItemId.length === 0) {
            console.log("No variants found without item_id");
            return NextResponse.json({
                success: true,
                message: "No variants found without item_id",
            });
        }

        console.log(
            `Found ${variantsWithoutItemId.length} variants without item_id`,
        );

        // 2. Get all research items that have keywords
        const { data: researchItems, error: researchError } = await supabase
            .from("market_research")
            .select("id, mr_keywords");

        if (researchError) {
            console.error("Error fetching research items:", researchError);
            return NextResponse.json({
                success: false,
                error: researchError.message,
            }, { status: 500 });
        }

        // 3. Create a map of keywords to item IDs
        type KeywordMap = {
            [keyword: string]: string; // keyword to item_id
        };

        const keywordToItemId: KeywordMap = {};
        let mappedKeywords = 0;

        researchItems.forEach((item) => {
            if (item.mr_keywords && Array.isArray(item.mr_keywords)) {
                item.mr_keywords.forEach((keywordObj) => {
                    // Handle both string and object keywords
                    let keyword: string | null = null;
                    if (typeof keywordObj === "string") {
                        keyword = keywordObj;
                    } else if (
                        typeof keywordObj === "object" && keywordObj !== null &&
                        "keyword" in keywordObj
                    ) {
                        keyword = String(keywordObj.keyword);
                    }

                    if (keyword) {
                        keywordToItemId[keyword.toLowerCase()] = item.id;
                        mappedKeywords++;
                    }
                });
            }
        });

        console.log(
            `Created map with ${mappedKeywords} keywords to ${
                Object.keys(keywordToItemId).length
            } unique item IDs`,
        );

        // 4. Update variants with matching item_id
        let updatedCount = 0;
        let errorCount = 0;
        const batchSize = 50;

        // Process variants in batches
        for (let i = 0; i < variantsWithoutItemId.length; i += batchSize) {
            const batch = variantsWithoutItemId.slice(i, i + batchSize);
            const updatePromises = batch.map(async (variant) => {
                try {
                    const matchingItemId =
                        keywordToItemId[variant.keyword.toLowerCase()];

                    if (matchingItemId) {
                        const { error: updateError } = await supabase
                            .from("keyword_variants")
                            .update({ item_id: matchingItemId })
                            .eq("variant_id", variant.variant_id);

                        if (updateError) {
                            console.error(
                                `Error updating variant ${variant.variant_id}:`,
                                updateError,
                            );
                            errorCount++;
                        } else {
                            updatedCount++;
                        }
                    }
                } catch (err) {
                    console.error(
                        `Error processing variant ${variant.variant_id}:`,
                        err,
                    );
                    errorCount++;
                }
            });

            await Promise.all(updatePromises);
            console.log(
                `Processed batch ${
                    i / batchSize + 1
                }: ${updatedCount} updated, ${errorCount} errors`,
            );
        }

        console.log(
            `Migration completed: Updated ${updatedCount} variants, ${errorCount} errors`,
        );
        return NextResponse.json({
            success: true,
            message:
                `Migration completed: Updated ${updatedCount} variants, ${errorCount} errors`,
            details: {
                totalVariants: variantsWithoutItemId.length,
                updatedCount,
                errorCount,
                matchedKeywords: mappedKeywords,
            },
        });
    } catch (error) {
        console.error("Unexpected error during migration:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
