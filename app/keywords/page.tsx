"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, AlertCircle, Clock, Download } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Define types for the UI
type StatusUpdate = {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "loading";
};

type KeywordVariant = {
  keyword: string;
  source: string;
  search_volume: number;
  cpc: number;
  keyword_difficulty: number;
  competition_percentage: number;
  efficiency_index: number;
  confidence_score: number;
  explanation: string;
  image_url?: string;
};

// Form validation schema
const formSchema = z.object({
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
  image_url: z.string().url({ message: "Please enter a valid URL" }).optional(),
});

export default function KeywordGenerator() {
  const [activeTab, setActiveTab] = useState("input");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [keywordVariants, setKeywordVariants] = useState<KeywordVariant[]>([]);
  const [exportLinks, setExportLinks] = useState({ csv: "", json: "" });
  const [generationComplete, setGenerationComplete] = useState(false);

  const statusEndRef = useRef<HTMLDivElement>(null);

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      visual_cues: "",
      pain_points: "",
      visitor_intent: "",
      target_audience: "",
      product_category: "",
      campaign_objective: "",
      image_url: "",
    },
  });

  // Scroll to the bottom of status updates when new ones are added
  useEffect(() => {
    if (statusEndRef.current) {
      statusEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [statusUpdates]);

  // Add a status update
  const addStatusUpdate = (message: string, type: StatusUpdate["type"]) => {
    const newUpdate: StatusUpdate = {
      id: Date.now().toString(),
      timestamp: new Date(),
      message,
      type,
    };
    setStatusUpdates((prev) => [...prev, newUpdate]);
  };

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsGenerating(true);
      setGenerationComplete(false);
      setProgress(0);
      setKeywordVariants([]);
      setExportLinks({ csv: "", json: "" });
      setStatusUpdates([]);

      // Move to the status tab
      setActiveTab("status");

      // Transform form data for API
      const adFeatures = {
        visual_cues: values.visual_cues.split(",").map((cue) => cue.trim()),
        pain_points: values.pain_points.split(",").map((point) => point.trim()),
        visitor_intent: values.visitor_intent,
        target_audience: JSON.parse(values.target_audience || "{}"),
        product_category: values.product_category || undefined,
        campaign_objective: values.campaign_objective || undefined,
        image_url: values.image_url || undefined,
      };

      addStatusUpdate("Starting keyword variant generation...", "info");
      setProgress(10);

      // First call to generate keywords
      addStatusUpdate("Generating keyword variants...", "loading");

      // Simulate steps for streaming updates
      await new Promise((resolve) => setTimeout(resolve, 1000));
      addStatusUpdate("Setting up ad feature extraction...", "info");
      setProgress(20);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      addStatusUpdate("Querying for similar content...", "info");
      setProgress(30);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      addStatusUpdate("Analyzing market research data...", "info");
      setProgress(40);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      addStatusUpdate("Generating keyword ideas...", "info");
      setProgress(50);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      addStatusUpdate("Calculating keyword metrics...", "info");
      setProgress(60);

      // Make the actual API call
      const generateResponse = await fetch("/api/keywords/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adFeatures),
      });

      if (!generateResponse.ok) {
        throw new Error(
          `Error generating keywords: ${generateResponse.statusText}`
        );
      }

      const keywords = await generateResponse.json();
      setKeywordVariants(keywords);
      addStatusUpdate(
        `Successfully generated ${keywords.length} keyword variants!`,
        "success"
      );
      setProgress(80);

      // Call export API
      addStatusUpdate(
        "Exporting keyword variants to CSV and JSON...",
        "loading"
      );

      const exportResponse = await fetch("/api/keywords/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adFeatures),
      });

      if (!exportResponse.ok) {
        throw new Error(
          `Error exporting keywords: ${exportResponse.statusText}`
        );
      }

      const exportData = await exportResponse.json();
      setExportLinks({
        csv: exportData.csv_export_path,
        json: exportData.json_export_path,
      });

      addStatusUpdate(
        `Exported ${exportData.total_variants} variants to CSV and JSON!`,
        "success"
      );
      setProgress(100);
      setGenerationComplete(true);

      // Move to the results tab
      setTimeout(() => {
        setActiveTab("results");
      }, 1000);
    } catch (error) {
      console.error("Error generating keywords:", error);
      addStatusUpdate(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
      setProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Keyword Variant Generator
          </h1>
          <p className="text-muted-foreground">
            Generate keyword variants based on ad features and market research
            data.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="status">Generation Status</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="input">
            <Card>
              <CardHeader>
                <CardTitle>Ad Features</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
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
                            Describe visual elements in the ad (e.g.,
                            &quot;running shoes, sports attire, track&quot;)
                          </FormDescription>
                          <FormMessage />
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
                            List pain points the product addresses (e.g.,
                            &quot;foot pain, poor performance, durability&quot;)
                          </FormDescription>
                          <FormMessage />
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
                            <Input
                              placeholder="Enter visitor intent"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Describe the visitor&apos;s intent (e.g.,
                            &quot;purchase running shoes&quot;)
                          </FormDescription>
                          <FormMessage />
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
                              placeholder='Enter target audience as JSON (e.g., {"age": "18-35", "interests": ["sports", "fitness"]})'
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Describe the target audience as a JSON object
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <FormMessage />
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="image_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Image URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter image URL (optional)"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Provide a URL to an image for more accurate keyword
                            generation
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={isGenerating}
                      className="w-full"
                    >
                      {isGenerating
                        ? "Generating..."
                        : "Generate Keyword Variants"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>Generation Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>

                <div className="border rounded-md p-4 mb-4">
                  <h3 className="font-medium mb-2">Status Updates</h3>
                  <ScrollArea className="h-[400px] w-full pr-4">
                    <div className="space-y-4">
                      {statusUpdates.map((update) => (
                        <div key={update.id} className="flex items-start gap-3">
                          {update.type === "info" && (
                            <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                          )}
                          {update.type === "success" && (
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                          )}
                          {update.type === "error" && (
                            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                          )}
                          {update.type === "loading" && (
                            <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p
                              className={`text-sm ${
                                update.type === "error" ? "text-red-500" : ""
                              }`}
                            >
                              {update.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {update.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={statusEndRef} />
                    </div>
                  </ScrollArea>
                </div>

                {generationComplete && (
                  <div className="flex justify-end">
                    <Button onClick={() => setActiveTab("results")}>
                      View Results
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Generated Keyword Variants</CardTitle>
              </CardHeader>
              <CardContent>
                {keywordVariants.length > 0 ? (
                  <div className="space-y-8">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Export Options</h3>
                        <div className="flex gap-2">
                          {exportLinks.csv && (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={exportLinks.csv}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download CSV
                              </a>
                            </Button>
                          )}
                          {exportLinks.json && (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={exportLinks.json}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download JSON
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                      <Separator />
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">
                        Generated Keywords ({keywordVariants.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {keywordVariants.map((variant, index) => (
                          <Card key={index} className="overflow-hidden">
                            <CardHeader className="bg-muted py-3">
                              <CardTitle className="text-md">
                                {variant.keyword}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-2 gap-y-2 text-sm mb-3">
                                <div className="font-medium">
                                  Search Volume:
                                </div>
                                <div>
                                  {variant.search_volume.toLocaleString()}
                                </div>

                                <div className="font-medium">CPC:</div>
                                <div>${variant.cpc.toFixed(2)}</div>

                                <div className="font-medium">Difficulty:</div>
                                <div>
                                  {variant.keyword_difficulty.toFixed(1)}/100
                                </div>

                                <div className="font-medium">Competition:</div>
                                <div>
                                  {(
                                    variant.competition_percentage * 100
                                  ).toFixed(1)}
                                  %
                                </div>

                                <div className="font-medium">Efficiency:</div>
                                <div>
                                  {variant.efficiency_index.toFixed(2)}/10
                                </div>

                                <div className="font-medium">Confidence:</div>
                                <div>
                                  {(variant.confidence_score * 100).toFixed(1)}%
                                </div>
                              </div>
                              <Separator className="my-3" />
                              <div className="text-sm">
                                <div className="font-medium mb-1">
                                  Explanation:
                                </div>
                                <p className="text-muted-foreground">
                                  {variant.explanation}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground mb-4">
                      No keyword variants generated yet
                    </p>
                    <Button onClick={() => setActiveTab("input")}>
                      Go to Input Form
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
