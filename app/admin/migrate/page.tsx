"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ReloadIcon } from "@radix-ui/react-icons";

// Define the type for migration results
interface MigrationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
  sqlError?: string;
  sqlException?: string;
}

export default function AdminMigrationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    current: number;
    total: number;
    processed: number;
    errors: number;
  } | null>(null);

  const runMigration = async (migrationPath: string) => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/db/migrate/${migrationPath}`);
      const data = (await response.json()) as MigrationResult;

      if (!response.ok) {
        throw new Error(data.error || "Migration failed");
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const generateVariantsForAllItems = async () => {
    setIsGeneratingVariants(true);
    setGenerationProgress({ current: 0, total: 0, processed: 0, errors: 0 });
    setError(null);

    try {
      // 1. Get all research items
      const itemsResponse = await fetch("/api/keywords/research-items");
      if (!itemsResponse.ok) {
        throw new Error(
          `Failed to fetch research items: ${itemsResponse.statusText}`
        );
      }

      const items = await itemsResponse.json();
      setGenerationProgress((prev) => ({
        ...prev!,
        total: items.length,
      }));

      // 2. Generate variants for each item in batches
      const batchSize = 3; // Process a few items at a time
      let processed = 0;
      let errors = 0;

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        // Update progress
        setGenerationProgress((prev) => ({
          ...prev!,
          current: i + 1,
        }));

        // Process each item in the batch
        await Promise.all(
          batch.map(async (item) => {
            try {
              if (!item.id) {
                throw new Error(`Item has no ID: ${JSON.stringify(item)}`);
              }

              // Basic ad features to generate variants
              const adFeatures = {
                visual_cues: item.keywords?.slice(0, 5) || ["product"],
                pain_points: ["problem", "challenge", "need"],
                visitor_intent: "learn",
                product_category: item.title?.split(" ")[0] || "general",
                campaign_objective: "awareness",
                image_url: item.image_url || null,
              };

              // Generate variants for this item
              const response = await fetch(
                `/api/keywords/generate-variants-for-item`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    item_id: item.id,
                    ad_features: adFeatures,
                  }),
                }
              );

              if (!response.ok) {
                throw new Error(
                  `Failed to generate variants for item ${item.id}: ${response.statusText}`
                );
              }

              processed++;
            } catch (itemError) {
              console.error(`Error processing item ${item.id}:`, itemError);
              errors++;
            }
          })
        );

        // Update progress after batch
        setGenerationProgress((prev) => ({
          ...prev!,
          processed,
          errors,
        }));

        // Add a small delay between batches to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Set final result
      setResult({
        success: true,
        message: `Generated variants for ${processed} items, with ${errors} errors.`,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while generating variants"
      );
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Database Migration Tools</h1>
      <p className="text-gray-600 mb-8">
        This page allows administrators to run database migrations. Be careful
        as these operations may modify the database schema.
      </p>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Add item_id Column Migration
              <Badge variant="outline">Schema Update</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              This migration adds an <code>item_id</code> column to the{" "}
              <code>keyword_variants</code> table to allow linking variants
              directly to market research items.
            </p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              onClick={() => runMigration("add-item-id-column")}
              disabled={isLoading}
            >
              {isLoading && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Run Migration
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Generate Variants for All Items
              <Badge variant="outline" className="bg-blue-50">
                Data Generation
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              This tool generates keyword variants for all market research
              items, ensuring that each variant is properly associated with its
              parent item via the <code>item_id</code> field.
            </p>
            {generationProgress && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (generationProgress.current /
                          generationProgress.total) *
                          100
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>
                    Processed: {generationProgress.processed}/
                    {generationProgress.total}
                  </span>
                  <span>Errors: {generationProgress.errors}</span>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              onClick={generateVariantsForAllItems}
              disabled={isGeneratingVariants}
              variant="outline"
            >
              {isGeneratingVariants && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Generate Variants
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Update Variants with Item IDs
              <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                Data Migration
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              This tool updates existing keyword variants to associate them with
              their parent research items. It analyzes the keywords in each
              variant and maps them to the appropriate research item.
            </p>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              onClick={() => runMigration("update-variants-item-id")}
              disabled={isLoading}
              variant="outline"
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            >
              {isLoading && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Variants
            </Button>
          </CardFooter>
        </Card>

        {error && (
          <Card className="border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-600">Migration Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card
            className={
              result.success
                ? "border-green-300 bg-green-50"
                : "border-yellow-300 bg-yellow-50"
            }
          >
            <CardHeader>
              <CardTitle
                className={
                  result.success ? "text-green-600" : "text-yellow-600"
                }
              >
                Migration Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={
                  result.success ? "text-green-600" : "text-yellow-600"
                }
              >
                {result.message}
              </p>
              {result.details && (
                <>
                  <Separator className="my-4" />
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Details:</h3>
                    <pre className="bg-black/5 p-3 rounded text-xs overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
