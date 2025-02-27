import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Define a type for the query response
type VariantRecord = {
    id: string;
    keyword: string;
    source: string;
    search_volume: number;
    cpc: number;
    keyword_difficulty: number;
    competition_percentage: number;
    efficiency_index: number;
    user_id: string;
    created_at: string;
    item_id?: string;
    [key: string]: unknown;
};

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
    const cookieStore = cookies();

    // Create a Supabase client with service role key
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
            // Get variants for this ID
            query = supabase
                .from("keyword_variants")
                .select("*")
                .eq("item_id", decodedKeyword)
                .eq("user_id", user.id)
                .order("efficiency_index", { ascending: false });
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
