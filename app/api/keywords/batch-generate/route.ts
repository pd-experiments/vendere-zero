import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// In-memory storage for task status
// In a production app, you would use Redis or another persistent store
export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface Task {
    id: string;
    userId: string;
    status: TaskStatus;
    progress: number;
    totalItems: number;
    completedItems: number;
    createdAt: Date;
    updatedAt: Date;
    result?: Record<string, unknown>;
    error?: string;
}

// Global task store
const tasks: Record<string, Task> = {};

export async function POST(request: NextRequest) {
    try {
        // For simplicity, we'll use a placeholder user ID
        // In a real app, you would get this from your auth system
        const userId = "user-1";

        const body = await request.json();

        // Extract data from request
        const { ad_features, item_ids } = body;

        if (!ad_features || !Array.isArray(item_ids) || item_ids.length === 0) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 },
            );
        }

        // Generate a unique task ID
        const taskId = uuidv4();

        // Create a new task record
        const task: Task = {
            id: taskId,
            userId,
            status: "pending",
            progress: 0,
            totalItems: item_ids.length,
            completedItems: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Save task to our store
        tasks[taskId] = task;

        // Start processing in the background
        // We don't await this to return quickly to the client
        processBatchGenerationTask(taskId, userId, ad_features, item_ids);

        // Return the task ID so the client can poll for status
        return NextResponse.json({
            taskId,
            status: "pending",
            message: `Batch generation started for ${item_ids.length} items`,
        });
    } catch (error) {
        console.error("Error in batch-generate API route:", error);
        return NextResponse.json(
            { error: "Failed to start batch generation" },
            { status: 500 },
        );
    }
}

async function processBatchGenerationTask(
    taskId: string,
    userId: string,
    adFeatures: Record<string, unknown>,
    itemIds: string[],
) {
    try {
        // Update task status to processing
        tasks[taskId].status = "processing";
        tasks[taskId].updatedAt = new Date();

        // Set progress to 10% to show we've started
        tasks[taskId].progress = 10;

        // Get research items for the selected IDs to extract keywords
        // Use direct Supabase query for research items instead of going through the API
        // to avoid authentication issues
        const { createServerClient } = await import("@supabase/ssr");
        const { cookies } = await import("next/headers");

        const cookieStore = cookies();
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

        console.log("Fetching research items for batch task:", taskId);

        // Call the RPC function to join market research and library items directly
        const { data: allItems, error } = await supabase
            .rpc("join_market_research_and_library_items");

        if (error) {
            console.error("Error fetching research items:", error);
            throw new Error(`Failed to fetch research items: ${error.message}`);
        }

        // Update progress
        tasks[taskId].progress = 30;
        tasks[taskId].updatedAt = new Date();

        // Filter only the items we need
        const selectedItems = allItems.filter((
            item: { mr_id?: string; li_id?: string },
        ) => itemIds.includes(item.mr_id || item.li_id || ""));

        // Log the selected items for debugging
        console.log(
            `Found ${selectedItems.length} items for processing`,
            selectedItems.map((item: {
                mr_id?: string;
                li_id?: string;
                mr_image_url?: string;
                li_preview_url?: string;
            }) => ({
                id: item.mr_id || item.li_id,
                mr_image_url: item.mr_image_url,
                li_preview_url: item.li_preview_url,
            })),
        );

        // Extract keywords from items
        // const keywords = selectedItems.map((item: {
        //     keyword?: string;
        //     li_name?: string;
        //     mr_intent_summary?: string;
        // }) =>
        //     item.keyword || item.li_name ||
        //     item.mr_intent_summary?.substring(0, 30)
        // ).filter(Boolean);

        // if (keywords.length === 0) {
        //     throw new Error("No valid keywords found in selected items");
        // }

        // Extract image URLs for each item to associate variants with correct items
        const itemImageUrls = selectedItems.map((item: {
            mr_id?: string;
            mr_image_url?: string;
            li_preview_url?: string;
        }) => {
            const imageUrl = item.mr_image_url || item.li_preview_url;
            if (!imageUrl) {
                console.warn(`Item ${item.mr_id} does not have an image URL`);
            }
            return {
                item_id: item.mr_id,
                image_url: imageUrl || "placeholder-image-url.jpg",
            };
        });

        // Log extracted image URLs
        console.log("Extracted image URLs:", itemImageUrls);

        // Prepare payload for the Python API
        const payload = {
            ad_features: {
                // Ensure all required fields are included with defaults if not provided
                visual_cues: adFeatures.visual_cues || ["Default visual cue"],
                pain_points: adFeatures.pain_points || ["Default pain point"],
                visitor_intent: adFeatures.visitor_intent || "Information",
                target_audience: adFeatures.target_audience || {
                    name: "General Audience",
                    demographics: {
                        age: "25-55",
                        gender: "All",
                    },
                },
                product_category: adFeatures.product_category || "General",
                campaign_objective: adFeatures.campaign_objective ||
                    "Awareness",
                // Don't use adFeatures.image_url as it's not reliable for batch processing
            },
            keywords: ["The primary intent of visitors"], // Default keyword for testing
            user_id: userId,
            // Pass the image URL directly instead of the array
            image_url: itemImageUrls.length > 0
                ? itemImageUrls[0].image_url
                : undefined,
        };

        // Update progress
        tasks[taskId].progress = 50;
        tasks[taskId].updatedAt = new Date();

        console.log(
            "Calling Python API with payload:",
            JSON.stringify(payload, null, 2),
        );

        // Call the Python API - FIXING THE PATH HERE
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ||
            "http://localhost:8000";
        const response = await fetch(
            `${apiUrl}/keywords/batch-generate`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            },
        );

        // Log the response status for debugging
        console.log(
            `Python API response status: ${response.status} ${response.statusText}`,
        );

        if (!response.ok) {
            let errorText =
                `API returned ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorText = errorData.message || errorData.error || errorText;
                console.error("Error response body:", errorData);
            } catch {
                console.error("Could not parse error response as JSON");
            }
            throw new Error(errorText);
        }

        // Get result
        const result = await response.json();
        console.log("Python API response:", JSON.stringify(result, null, 2));

        // Update task as completed
        tasks[taskId].status = "completed";
        tasks[taskId].progress = 100;
        tasks[taskId].completedItems = result.successful || 0;
        tasks[taskId].result = result;
        tasks[taskId].updatedAt = new Date();

        console.log(`Batch task ${taskId} completed successfully`);

        // Clean up task after some time (e.g., 1 hour)
        setTimeout(() => {
            delete tasks[taskId];
        }, 60 * 60 * 1000);
    } catch (error) {
        console.error(`Error processing batch task ${taskId}:`, error);

        // Update task as failed
        tasks[taskId].status = "failed";
        tasks[taskId].error = error instanceof Error
            ? error.message
            : "Unknown error";
        tasks[taskId].updatedAt = new Date();

        // Clean up task after some time (e.g., 1 hour)
        setTimeout(() => {
            delete tasks[taskId];
        }, 60 * 60 * 1000);
    }
}

// GET endpoint to check task status
export async function GET(request: NextRequest) {
    try {
        // Get task ID from query params
        const url = new URL(request.url);
        const taskId = url.searchParams.get("taskId");

        if (!taskId) {
            return NextResponse.json(
                { error: "Task ID is required" },
                { status: 400 },
            );
        }

        // For simplicity, we'll skip auth checks in this example
        // In a real app, you would verify the user's session here

        // Get task
        const task = tasks[taskId];

        if (!task) {
            return NextResponse.json(
                { error: "Task not found" },
                { status: 404 },
            );
        }

        // Return task details
        return NextResponse.json({
            id: task.id,
            status: task.status,
            progress: task.progress,
            totalItems: task.totalItems,
            completedItems: task.completedItems,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            result: task.result,
            error: task.error,
        });
    } catch (error) {
        console.error("Error in get task status API route:", error);
        return NextResponse.json(
            { error: "Failed to get task status" },
            { status: 500 },
        );
    }
}
