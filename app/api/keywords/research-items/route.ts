import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
        const { data, error } = await supabase.rpc(
            "join_market_research_and_library_items",
        );

        if (error) {
            console.error("Error fetching research items:", error);
            return NextResponse.json(
                { error: "Failed to fetch research items" },
                { status: 500 },
            );
        }

        // For each item, get the count of keyword variants
        for (const item of data) {
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

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error in research items API:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
