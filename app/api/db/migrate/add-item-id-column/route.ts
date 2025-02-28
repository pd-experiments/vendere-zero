import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
    try {
        console.log(
            "Starting migration to add item_id column to keyword_variants table",
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

        // Check if the column already exists by trying to select it
        console.log("Checking if item_id column already exists");
        try {
            const { data: testData, error: testError } = await supabase
                .from("keyword_variants")
                .select("item_id")
                .limit(1);

            if (!testError) {
                // Column exists
                console.log(
                    "item_id column already exists in keyword_variants table",
                );
                return NextResponse.json({
                    success: true,
                    message:
                        "item_id column already exists in keyword_variants table",
                });
            }

            // If we got an error, we might not have the column - proceed with the migration
            console.log("Column does not exist, proceeding with migration");
        } catch (error) {
            console.log("Error checking column existence:", error);
            // Continue with migration attempt
        }

        // Call our SQL function to add the column
        const { data, error } = await supabase.rpc(
            "add_item_id_column_to_keyword_variants",
        );

        if (error) {
            console.error("Error adding item_id column:", error);

            // Alternative: Try direct SQL if RPC fails
            console.log("Attempting to add column using direct SQL");
            try {
                const { data: sqlData, error: sqlError } = await supabase.rpc(
                    "execute_sql",
                    {
                        sql: "ALTER TABLE keyword_variants ADD COLUMN IF NOT EXISTS item_id UUID;",
                    },
                );

                if (sqlError) {
                    console.error("Direct SQL also failed:", sqlError);
                    return NextResponse.json({
                        success: false,
                        error: error.message,
                        sqlError: sqlError.message,
                    }, { status: 500 });
                }

                console.log(
                    "Successfully added item_id column using direct SQL",
                );
                return NextResponse.json({
                    success: true,
                    message: "Added item_id column using direct SQL",
                });
            } catch (sqlError) {
                console.error("Direct SQL attempt caught exception:", sqlError);
                return NextResponse.json({
                    success: false,
                    error: error.message,
                    sqlException: sqlError instanceof Error
                        ? sqlError.message
                        : String(sqlError),
                }, { status: 500 });
            }
        }

        console.log(
            "Successfully added item_id column to keyword_variants table",
        );
        return NextResponse.json({
            success: true,
            message: "Added item_id column to keyword_variants table",
            details: data,
        });
    } catch (error) {
        console.error("Unexpected error during migration:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        }, { status: 500 });
    }
}
