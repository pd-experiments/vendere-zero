import { NextRequest, NextResponse } from "next/server";

export const GET = async (req: NextRequest): Promise<Response> => {
    try {
        // Get the image URL from the query params
        const url = req.nextUrl.searchParams.get("url");

        if (!url) {
            return new NextResponse("Missing URL parameter", { status: 400 });
        }

        // Decode the URL (it will be encoded in the query param)
        const decodedUrl = decodeURIComponent(url);

        console.log(`Proxying image from: ${decodedUrl}`);

        // Fetch the image
        const imageResponse = await fetch(decodedUrl, {
            headers: {
                // Some common headers to avoid being blocked
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://www.google.com/",
            },
        });

        if (!imageResponse.ok) {
            console.error(
                `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`,
            );
            return new NextResponse("Failed to fetch image", {
                status: imageResponse.status,
            });
        }

        // Get the image data
        const imageBuffer = await imageResponse.arrayBuffer();

        // Get the content type
        const contentType = imageResponse.headers.get("content-type") ||
            "image/jpeg";

        // Return the image with the correct content type
        return new NextResponse(imageBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (error) {
        console.error("Error proxying image:", error);
        return new NextResponse("Error proxying image", { status: 500 });
    }
};
