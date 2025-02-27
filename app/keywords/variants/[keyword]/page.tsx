"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";

// Define the variant type
type KeywordVariant = {
  id: string;
  keyword: string;
  source: string;
  search_volume: number;
  cpc: number;
  keyword_difficulty: number;
  competition_percentage: number;
  efficiency_index: number;
  created_at: string;
};

// Form schema for generation
const generationSchema = z.object({
  visual_cues: z
    .string()
    .min(3, { message: "Please add at least one visual cue" }),
  pain_points: z
    .string()
    .min(3, { message: "Please add at least one pain point" }),
  visitor_intent: z.string().min(3, { message: "Visitor intent is required" }),
  target_audience: z
    .string()
    .min(3, { message: "Target audience is required" }),
  product_category: z.string().optional(),
  campaign_objective: z.string().optional(),
});

export default function KeywordVariantsPage({
  params,
}: {
  params: { keyword: string };
}) {
  const router = useRouter();
  const [variants, setVariants] = useState<KeywordVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Decode the keyword
  const decodedKeyword = decodeURIComponent(params.keyword);

  // Initialize form
  const form = useForm<z.infer<typeof generationSchema>>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      visual_cues: "",
      pain_points: "",
      visitor_intent: "",
      target_audience: "{}",
      product_category: "",
      campaign_objective: "",
    },
  });

  // Fetch variants on component mount
  useEffect(() => {
    fetchVariants();
  }, [params.keyword]);

  // Close dialog when done generating
  useEffect(() => {
    if (!isGenerating && showGenerateDialog) {
      setShowGenerateDialog(false);
    }
  }, [isGenerating, showGenerateDialog]);

  // Fetch variants from API
  const fetchVariants = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/keywords/variants/${encodeURIComponent(params.keyword)}`
      );
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      setVariants(data);
    } catch (error) {
      console.error("Error fetching variants:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not fetch variants"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle variant generation
  const onGenerate = async (values: z.infer<typeof generationSchema>) => {
    setIsGenerating(true);
    try {
      // Transform form data for API
      const adFeatures = {
        visual_cues: values.visual_cues.split(",").map((cue) => cue.trim()),
        pain_points: values.pain_points.split(",").map((point) => point.trim()),
        visitor_intent: values.visitor_intent,
        target_audience: JSON.parse(values.target_audience),
        product_category: values.product_category || undefined,
        campaign_objective: values.campaign_objective || undefined,
      };

      const response = await fetch("/api/keywords/batch-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ad_features: adFeatures,
          keywords: [decodedKeyword],
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const result = await response.json();

      toast.success(
        `Generation completed: Generated ${result.variants_generated} variants for ${result.successful} keywords. ${result.failed} keywords failed.`
      );

      // Refresh the variants list
      fetchVariants();
    } catch (error) {
      console.error("Error generating variants:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not generate variants"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle export
  const handleExport = async (format: "csv" | "json") => {
    setExportFormat(format);
    setIsExporting(true);
    try {
      const response = await fetch("/api/keywords/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: decodedKeyword,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.download_url) {
        setExportUrl(data.download_url);
        toast.success(
          `Export completed. Click the download button to download your file.`
        );
      } else {
        throw new Error("No download URL provided");
      }
    } catch (error) {
      console.error("Error exporting variants:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not export variants"
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Function to format metrics for display
  const formatMetric = (value: number, type: string) => {
    switch (type) {
      case "volume":
        return value.toLocaleString();
      case "cpc":
        return `$${value.toFixed(2)}`;
      case "difficulty":
        return `${value.toFixed(1)}/100`;
      case "percentage":
        return `${(value * 100).toFixed(1)}%`;
      case "index":
        return `${value.toFixed(2)}/10`;
      default:
        return value.toString();
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/keywords/list")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Variants for &quot;{decodedKeyword}&quot;
            </h1>
            <p className="text-muted-foreground">
              {variants.length} variants generated for this keyword
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport("csv")}
              disabled={isExporting || variants.length === 0}
              className="relative"
            >
              {isExporting && exportFormat === "csv" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : null}
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport("json")}
              disabled={isExporting || variants.length === 0}
              className="relative"
            >
              {isExporting && exportFormat === "json" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : null}
              <Download className="mr-2 h-4 w-4" /> Export JSON
            </Button>
            <Button
              variant="default"
              onClick={() => setShowGenerateDialog(true)}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Generate Variants
            </Button>
          </div>
        </div>

        {exportUrl && (
          <Card className="bg-muted/50">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Export ready for download</p>
                <p className="text-sm text-muted-foreground">
                  Your file has been prepared and is ready to download
                </p>
              </div>
              <Button
                variant="default"
                onClick={() => window.open(exportUrl, "_blank")}
              >
                <Download className="mr-2 h-4 w-4" /> Download File
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Keyword Variants</CardTitle>
            <CardDescription>
              Performance metrics and data for variants of &quot;
              {decodedKeyword}&quot;
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Search Volume</TableHead>
                    <TableHead>CPC</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Competition</TableHead>
                    <TableHead>Efficiency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        <div className="flex justify-center items-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : variants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        No variants found for this keyword
                      </TableCell>
                    </TableRow>
                  ) : (
                    variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell className="font-medium">
                          {variant.source}
                        </TableCell>
                        <TableCell>
                          {formatMetric(variant.search_volume, "volume")}
                        </TableCell>
                        <TableCell>
                          {formatMetric(variant.cpc, "cpc")}
                        </TableCell>
                        <TableCell>
                          {formatMetric(
                            variant.keyword_difficulty,
                            "difficulty"
                          )}
                        </TableCell>
                        <TableCell>
                          {formatMetric(
                            variant.competition_percentage,
                            "percentage"
                          )}
                        </TableCell>
                        <TableCell>
                          {formatMetric(variant.efficiency_index, "index")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generation Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Generate Variants</DialogTitle>
            <DialogDescription>
              Generate new variants for &quot;{decodedKeyword}&quot;
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onGenerate)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="visual_cues"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visual Cues</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter visual cues, comma separated"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Describe visual elements (e.g., &quot;running shoes,
                      sports attire&quot;)
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pain_points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pain Points</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter pain points, comma separated"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      List pain points (e.g., &quot;foot pain, poor
                      performance&quot;)
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visitor_intent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visitor Intent</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter visitor intent" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_audience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Audience</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Enter target audience as JSON (e.g., {"age": "18-35"})'
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="product_category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Category</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter product category (optional)"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="campaign_objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Objective</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter campaign objective (optional)"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGenerateDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
