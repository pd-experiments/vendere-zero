import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

        // Get variants for this keyword
        const { data, error } = await supabase
            .from("keyword_variants")
            .select("*")
            .eq("keyword", decodedKeyword)
            .eq("user_id", user.id)
            .order("efficiency_index", { ascending: false });

        if (error) {
            console.error("Error fetching variants:", error);
            return NextResponse.json(
                { error: "Failed to fetch variants" },
                { status: 500 },
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error in variants API:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
