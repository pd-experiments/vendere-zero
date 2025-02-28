import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Define the AdFeatures interface to match what's expected by the API
interface AdFeatures {
    visual_cues: string[];
    pain_points: string[];
    visitor_intent: string;
    target_audience?: {
        name: string;
        [key: string]: unknown;
    };
    product_category?: string;
    campaign_objective?: string;
    image_url?: string | null;
    [key: string]: unknown;
}

// Define the expected request body
interface RequestBody {
    ad_features: AdFeatures;
    keyword?: string;
    image_url?: string;
}

export async function POST(request: Request) {
    try {
        // Parse the request body
        const requestBody: RequestBody = await request.json();
        const { ad_features, keyword, image_url } = requestBody;

        console.log(
            `Generating variants for keyword: ${keyword} with image URL: ${image_url}`,
        );

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

        // Ensure the image URL is set in the ad_features
        const enrichedAdFeatures: AdFeatures = {
            ...ad_features,
            // Always use the image URL to ensure matching
            image_url: image_url || ad_features.image_url,
        };

        // Call the Python API to generate the variants
        console.log(
            `Calling Python API to generate variants for keyword: ${keyword} with image_url: ${enrichedAdFeatures.image_url}`,
        );

        const response = await fetch(`${pythonApiUrl}/keywords/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ad_features: enrichedAdFeatures,
                user_id: user.id,
                // If a specific keyword is provided, we use it
                ...(keyword && { specific_keyword: keyword }),
                // Pass the image URL
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
            `Generated ${generatedVariants.length} variants for keyword: ${keyword} with image_url: ${enrichedAdFeatures.image_url}`,
        );

        // Return the generated variants directly
        return NextResponse.json(generatedVariants);
    } catch (error) {
        console.error("Error in generate variants API:", error);
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
