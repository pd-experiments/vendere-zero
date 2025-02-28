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
        // Check if the item_id column exists
        const { data: columns, error: columnsError } = await supabase
            .from("keyword_variants")
            .select()
            .limit(1);

        if (columnsError) {
            console.error(
                "Error checking keyword_variants table:",
                columnsError,
            );
            return NextResponse.json(
                { error: "Failed to check keyword_variants table" },
                { status: 500 },
            );
        }

        // If no columns error, attempt to add the column using raw SQL
        const { error: migrationError } = await supabase.rpc(
            "add_item_id_column_to_keyword_variants",
        );

        if (migrationError) {
            console.error("Error adding item_id column:", migrationError);
            return NextResponse.json(
                {
                    error: "Failed to add item_id column",
                    details: migrationError,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            message:
                "Successfully added item_id column to keyword_variants table",
        });
    } catch (error) {
        console.error("Error in migration API:", error);
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
