"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Card as InnerCard,
  CardContent as InnerCardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Plus,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Loader2,
  SwatchBook,
  EllipsisVertical,
  FolderOpen,
  FolderClosed,
  LibraryBig,
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Task, TaskStatus } from "@/app/components/TaskManager";
import TaskManager from "@/app/components/TaskManager";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define proper types for the research item data
type TargetAudience = {
  name: string;
  pain_points: string[];
  preferences: string[];
  characteristics: string[];
};

type KeyFeature = {
  name: string;
  importance_score: number;
  mentioned_benefits: string[];
};

type Keyword = {
  keyword: string;
  intent_reflected: string;
  likelihood_score: number;
};

type OriginalHeadline = {
  headline_text: string;
  headline_type: string;
  visual_context: string;
};

type NewHeadline = {
  improved: string;
  original: string;
  improvements: string[];
  expected_impact: string[];
  target_audience: string[];
  pain_point_addressed: string[];
};

// Update the ResearchItem type with proper typing
type ResearchItem = {
  id: string;
  title: string;
  keyword: string | null;
  description: string;
  intent_summary: string;
  created_at: string;
  mr_id?: string;
  li_id?: string;
  image_url?: string;
  preview_url?: string;
  mr_image_url?: string;
  li_preview_url?: string;
  mr_intent_summary?: string;
  mr_target_audience?: Record<string, any>;
  mr_pain_points?: Record<string, any>;
  variant_count: number;
  expanded?: boolean;
  variants: any[];
  li_name?: string;
  isLoadingVariants?: boolean;
  isGeneratingVariants?: boolean;
  // Additional fields
  similar_keywords?: { keyword: string; similarity?: number }[];
  explanation?: string;
  mr_key_features?: Array<KeyFeature>;
  mr_buying_stage?: string;
  mr_perplexity_insights?: string;
  mr_new_headlines?: Array<NewHeadline>;
  mr_citations?: string[];
  mr_competitive_advantages?: string[];
  li_features?: string[];
  li_sentiment_tones?: string[];
  li_avg_sentiment_confidence?: number;
  mr_keywords?: Array<Keyword>;
};

// Comment out or remove the form schema
// const batchGenerationSchema = z.object({
//   visual_cues: z
//     .string()
//     .min(3, { message: "Please add at least one visual cue" }),
//   pain_points: z
//     .string()
//     .min(3, { message: "Please add at least one pain point" }),
//   visitor_intent: z.string().min(3, { message: "Visitor intent is required" }),
//   target_audience: z
//     .string()
//     .min(3, { message: "Target audience is required" }),
//   product_category: z.string().optional(),
//   campaign_objective: z.string().optional(),
// });

// AdImage component for handling image loading and fallbacks
const AdImage = ({
  src,
  className = "",
  size = 100,
  alt = "Ad image",
}: {
  src?: string;
  className?: string;
  size?: number;
  alt?: string;
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wasBlocked, setWasBlocked] = useState(false);
  const [usedProxy, setUsedProxy] = useState(false);

  // Check if a URL is likely to be blocked by ad blockers
  const isLikelyToBeBlocked = (url: string): boolean => {
    return (
      url.includes("googlesyndication") ||
      url.includes("googleads") ||
      url.includes("doubleclick") ||
      url.includes("ad.") ||
      url.includes(".ad") ||
      url.includes("ads.") ||
      url.includes(".ads")
    );
  };

  // Process image URL - use proxy for potentially blocked URLs
  const getImageUrl = (originalUrl?: string): string | undefined => {
    if (!originalUrl) return undefined;

    // If it's a data URL, return as is
    if (originalUrl.startsWith("data:")) return originalUrl;

    // If URL is likely to be blocked, use our proxy
    if (isLikelyToBeBlocked(originalUrl)) {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(
        originalUrl
      )}`;
      console.log(`Using proxy for blocked URL: ${proxyUrl}`);
      setUsedProxy(true);
      return proxyUrl;
    }

    // Otherwise return the original URL
    return originalUrl;
  };

  // Computed image URL with proxy if needed
  const imageUrl = useMemo(() => getImageUrl(src), [src]);

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
    setWasBlocked(false);
    setUsedProxy(false);

    // Log the image URL we're trying to load for debugging
    if (src) {
      console.log(`Original image URL: ${src}`);
      if (isLikelyToBeBlocked(src)) {
        console.warn(
          "Image URL may be blocked by ad blockers - using proxy:",
          src
        );
      }
    } else {
      // Instead of warning, just log at debug level to reduce console noise
      console.debug("No image source provided, using fallback");
    }
  }, [src]);

  // Function to detect errors
  const handleImageError = () => {
    console.error(`Failed to load image: ${imageUrl}`);

    // If we tried with the proxy and still failed
    if (usedProxy) {
      console.error("Even proxy couldn't load the image");
    }

    setHasError(true);
    setIsLoading(false);

    // If the URL seems like it would be blocked, mark it
    if (src && isLikelyToBeBlocked(src)) {
      setWasBlocked(true);
    }
  };

  // If no source or error, show fallback
  if (!imageUrl || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 text-xs text-center p-1 rounded-none ${className}`}
        style={{ width: size, height: size }}
      >
        {wasBlocked ? (
          <div className="flex flex-col items-center">
            <span>Ad Preview</span>
            <span className="text-[9px] mt-1">(Blocked by browser)</span>
          </div>
        ) : (
          <span>{hasError ? "Failed to load" : "No image"}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative border rounded-none overflow-hidden"
      style={{ width: size, height: size }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <span className="animate-pulse">Loading...</span>
        </div>
      )}
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className="object-cover"
        onError={handleImageError}
        onLoadingComplete={() => {
          console.log(`Successfully loaded image: ${imageUrl}`);
          setIsLoading(false);
        }}
        unoptimized // Try this if images are still failing
      />
    </div>
  );
};

// Progress bar for importance scores with label
const ImportanceScore = ({
  score,
  label,
}: {
  score: number;
  label: string;
}) => {
  // Calculate color based on score
  const getColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500 dark:bg-green-600";
    if (score >= 0.6) return "bg-yellow-500 dark:bg-yellow-600";
    return "bg-orange-500 dark:bg-orange-600";
  };

  return (
    <div className="mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-medium">
          {(score * 10).toFixed(1)}/10
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
        <div
          className={`h-2 rounded-full ${getColor(score)}`}
          style={{ width: `${score * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

// Target audience card component
const TargetAudienceCard = ({ audience }: { audience: TargetAudience }) => {
  return (
    <div className="rounded-lg bg-background border p-4 mb-3">
      <h4 className="font-semibold text-base mb-2">{audience.name}</h4>

      {audience.characteristics && audience.characteristics.length > 0 && (
        <div className="mb-3">
          <h5 className="text-sm font-medium text-muted-foreground mb-1">
            Characteristics
          </h5>
          <div className="flex flex-wrap gap-1">
            {audience.characteristics.map((char: string, i: number) => (
              <Badge key={i} variant="outline" className="bg-primary/10 text-primary rounded-none border-primary/20 text-xs">
                {char}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {audience.preferences && audience.preferences.length > 0 && (
        <div className="mb-3">
          <h5 className="text-sm font-medium text-muted-foreground mb-1">
            Preferences
          </h5>
          <div className="flex flex-wrap gap-1">
            {audience.preferences.map((pref: string, i: number) => (
              <Badge
                key={i}
                variant="default"
                className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
              >
                {pref}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {audience.pain_points && audience.pain_points.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-muted-foreground mb-1">
            Pain Points
          </h5>
          <div className="flex flex-wrap gap-1">
            {audience.pain_points.map((pain: string, i: number) => (
              <Badge
                key={i}
                variant="destructive"
                className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
              >
                {pain}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Feature Card Component
const FeatureCard = ({ feature }: { feature: KeyFeature }) => {
  return (
    <div className="rounded-lg bg-background border p-4 mb-3">
      <h4 className="font-semibold text-base mb-2">{feature.name}</h4>

      <ImportanceScore score={feature.importance_score} label="Importance" />

      {feature.mentioned_benefits && feature.mentioned_benefits.length > 0 && (
        <div className="mt-3">
          <h5 className="text-sm font-medium text-muted-foreground mb-1">
            Benefits
          </h5>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {feature.mentioned_benefits.map((benefit: string, i: number) => (
              <li key={i}>{benefit}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Fix linter error for avg_sentiment_confidence by ensuring it's treated as a number
const formatSentimentConfidence = (value: number | string): string => {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return `${(numValue * 100).toFixed(1)}%`;
};

export default function KeywordsList() {
  const router = useRouter();
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ResearchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] =
    useState<ResearchItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>("items");
  const [showMainDetails, setShowMainDetails] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activePollTaskIds, setActivePollTaskIds] = useState<string[]>([]);

  // Fetch research items on component mount
  useEffect(() => {
    fetchResearchItems();
  }, []);

  // Filter items when search query changes
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredItems(researchItems);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredItems(
        researchItems.filter(
          (item) =>
            item.li_name?.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query) ||
            item.mr_intent_summary?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, researchItems]);

  // Fetch research items from API with timeout and retry logic
  const fetchResearchItems = async (retryCount = 0) => {
    setIsLoading(true);
    setLoadError(null);

    // Create an abort controller to handle timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increase to 15 seconds

    try {
      const response = await fetch("/api/keywords/research-items", {
        signal: controller.signal,
        // Add cache: 'no-store' to prevent caching issues
        cache: "no-store",
        // Add additional headers to prevent caching
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      // Clear the timeout since the request completed
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Check if response contains an error object
      if (data && typeof data === "object" && "error" in data) {
        console.error("API returned an error:", data);
        throw new Error(data.message || data.error || "API returned an error");
      }

      // If we get an empty array but not explicitly intended, treat as an error
      if (Array.isArray(data) && data.length === 0) {
        console.log("Received empty data array from API");
      }

      // Process the data without modifying the URLs - our AdImage component will handle proxying
      const itemsWithExpanded = (data || []).map((item: ResearchItem) => {
        // Log original URLs for debugging
        if (item.mr_image_url) {
          console.log(`Original mr_image_url: ${item.mr_image_url}`);
        }
        if (item.li_preview_url) {
          console.log(`Original li_preview_url: ${item.li_preview_url}`);
        }

        return {
          ...item,
          expanded: false,
          variants: item.variants || [],
          variant_count:
            typeof item.variant_count === "number" ? item.variant_count : 0,
        };
      });

      setResearchItems(itemsWithExpanded);
      setFilteredItems(itemsWithExpanded);
      setLoadError(null);

      // Show success toast for manual refresh (not on initial load)
      if (retryCount > 0 || !document.hidden) {
        toast.success(
          `Successfully loaded ${itemsWithExpanded.length} research items`
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching research items:", error);

      // Handle timeout specifically
      if (error instanceof Error && error.name === "AbortError") {
        setLoadError("Request timed out. The server took too long to respond.");
        toast.error("Request timed out. The server took too long to respond.");
      } else {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Could not fetch research items";
        setLoadError(errorMessage);
        toast.error(errorMessage);
      }

      // Retry logic (max 2 retries)
      if (retryCount < 2) {
        console.log(`Retrying request (${retryCount + 1}/2)...`);
        setTimeout(() => fetchResearchItems(retryCount + 1), 2000);
        return;
      }

      // If all retries failed, set empty data
      setResearchItems([]);
      setFilteredItems([]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  // Toggle item selection
  const toggleItemSelection = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  // Toggle all items selection
  const toggleAllItems = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map((item) => item.id));
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = async (index: number) => {
    const newItems = [...filteredItems];
    const item = newItems[index];

    // Toggle expanded state
    item.expanded = !item.expanded;

    // If expanding and no variants loaded yet, fetch them
    if (item.expanded && item.variants.length === 0) {
      // Set a loading state for this specific item
      item.isLoadingVariants = true;
      setFilteredItems([...newItems]);

      try {
        // Create an abort controller for timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        // Use the ID directly as we've updated the API to handle IDs
        const itemId = encodeURIComponent(item.id);
        console.log(`Fetching variants for item ID: ${itemId}`);

        const response = await fetch(`/api/keywords/variants/${itemId}`, {
          signal: controller.signal,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        // Clear timeout
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
            errorData.error ||
            `Error: ${response.status} ${response.statusText}`
          );
        }

        const variants = await response.json();

        // Check if the response is valid
        if (!Array.isArray(variants)) {
          throw new Error("Invalid response format for variants");
        }

        console.log(
          `Received ${variants.length} variants for item ID: ${itemId}`
        );

        // If no variants returned but we know there should be some, try refreshing the list
        if (variants.length === 0 && item.variant_count > 0) {
          console.log(
            "No variants found but variant_count > 0, will refresh the list"
          );
          toast.info("Refreshing list to update variant counts...");
          // This will refresh all items and their variant counts
          await fetchResearchItems();
          // Try fetching variants again after a short delay
          setTimeout(() => toggleRowExpansion(index), 1000);
          return;
        }

        item.variants = variants;
        item.variant_count = variants.length;

        // Update the corresponding research item's variant count as well
        const researchItemIndex = researchItems.findIndex(
          (ri) => ri.id === item.id
        );
        if (researchItemIndex >= 0) {
          const updatedResearchItems = [...researchItems];
          updatedResearchItems[researchItemIndex].variant_count =
            variants.length;
          setResearchItems(updatedResearchItems);
        }
      } catch (error) {
        console.error(
          `Error fetching variants for ${item.li_name || item.id}:`,
          error
        );

        // Handle specific error cases for better user feedback
        if (error instanceof Error) {
          if (error.name === "AbortError") {
            toast.error(
              `Request timeout: Could not load variants for ${item.li_name || "this item"
              } within the time limit.`
            );
          } else {
            toast.error(
              `Could not load variants for ${item.li_name || "this item"}: ${error.message
              }`
            );
          }
        } else {
          toast.error(
            `Could not load variants for ${item.li_name || "this item"}`
          );
        }

        item.variants = [];
      } finally {
        // Clear loading state
        item.isLoadingVariants = false;
        setFilteredItems([...newItems]);
      }
    }

    setFilteredItems(newItems);
  };

  // Function to handle item selection for detailed view
  const viewItemDetails = (item: ResearchItem, inDialog = false) => {
    setSelectedItemDetails(item);
    if (inDialog) {
      setActiveTab("details");
      setShowBatchDialog(true);
    } else {
      setShowMainDetails(true);
    }
  };

  // Poll for task status updates
  useEffect(() => {
    // Don't poll if no tasks are active
    if (activePollTaskIds.length === 0) return;

    const pollInterval = setInterval(async () => {
      // For each active task, poll for its status
      for (const taskId of activePollTaskIds) {
        try {
          const response = await fetch(
            `/api/keywords/batch-generate?taskId=${taskId}`
          );

          if (!response.ok) {
            console.error(
              `Failed to poll task ${taskId}: ${response.statusText}`
            );
            continue;
          }

          const taskData = await response.json();

          // Update the task in state
          setTasks((prevTasks) =>
            prevTasks.map((task) =>
              task.id === taskId ? { ...task, ...taskData } : task
            )
          );

          // If task is completed or failed, stop polling for it
          if (taskData.status === "completed" || taskData.status === "failed") {
            setActivePollTaskIds((prev) => prev.filter((id) => id !== taskId));

            // Show a toast notification about completion
            if (taskData.status === "completed") {
              toast.success(
                `Task completed: Generated ${taskData.result?.variants_generated || 0
                } variants`
              );
            } else if (taskData.status === "failed") {
              toast.error(`Task failed: ${taskData.error || "Unknown error"}`);
            }
          }
        } catch (error) {
          console.error(`Error polling task ${taskId}:`, error);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [activePollTaskIds]);

  // Handle removing a task from the UI
  const handleRemoveTask = (taskId: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    setActivePollTaskIds((prev) => prev.filter((id) => id !== taskId));
  };

  // Helper function to update loading states for items
  const setItemLoadingState = (
    itemId: string,
    stateKey: "isLoadingVariants" | "isGeneratingVariants",
    value: boolean
  ) => {
    setResearchItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            [stateKey]: value,
          };
        }
        return item;
      })
    );
  };

  // Generate variants for an item
  const generateVariants = async (item: ResearchItem) => {
    setItemLoadingState(item.id, "isGeneratingVariants", true);

    try {
      // Prepare ad features for the API call
      const adFeatures = {
        visual_cues: ["product", "service", "solution"],
        pain_points: ["time", "cost", "quality"],
        visitor_intent: "find solution",
        target_audience: { name: "General audience" },
        product_category: "general",
        campaign_objective: "awareness",
      };

      // Get the image URL from mr_image_url or li_preview_url
      const imageUrl = item.mr_image_url || item.li_preview_url;

      console.log(
        `Generating variants for item ${item.id} with image: ${imageUrl}`
      );

      // Make the API call to generate variants
      const response = await fetch("/api/keywords/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ad_features: adFeatures,
          keyword: item.keyword,
          item_id: item.id,
          // Pass the image URL directly
          image_url: imageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const variants = await response.json();
      console.log(`Generated ${variants.length} variants for ${item.id}`);

      // Update the local state with the new variants
      setResearchItems((prevItems) =>
        prevItems.map((prevItem) => {
          if (prevItem.id === item.id) {
            return {
              ...prevItem,
              variants: variants,
              variant_count: variants.length,
            };
          }
          return prevItem;
        })
      );

      // Show success notification
      toast.success(
        `Generated ${variants.length} keyword variants for ${item.id}`
      );
    } catch (error) {
      console.error("Error generating variants:", error);
      toast.error(
        `Failed to generate variants: ${error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setItemLoadingState(item.id, "isGeneratingVariants", false);
    }
  };

  // Handle batch generation with task tracking
  const onBatchGenerate = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one item to generate variants");
      return;
    }

    // Get the selected items for batch generation
    const selectedItemsData = filteredItems.filter((item) =>
      selectedItems.includes(item.id)
    );

    if (selectedItemsData.length === 0) {
      toast.error("No valid items selected for batch generation");
      return;
    }

    setIsGenerating(true);
    try {
      // Log selected items for debugging
      console.log(
        `Generating variants for ${selectedItemsData.length} items:`,
        selectedItemsData.map((item) => item.id)
      );

      // Create default values for API
      const adFeatures = {
        visual_cues: ["product", "service", "solution"],
        pain_points: ["time", "cost", "quality"],
        visitor_intent: "find solution",
        target_audience: { name: "General audience" },
        product_category: "general",
        campaign_objective: "awareness",
      };

      console.log("Sending request to batch-generate API with data:", {
        adFeatures: adFeatures,
        itemIds: selectedItemsData.map((item) => item.id),
      });

      const response = await fetch("/api/keywords/batch-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ad_features: adFeatures,
          item_ids: selectedItemsData.map((item) => item.id),
        }),
      });

      console.log(
        `API response status: ${response.status} ${response.statusText}`
      );

      if (!response.ok) {
        let errorMessage = `Error: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error("Error response:", errorData);
        } catch {
          console.error("Could not parse error response");
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Batch generation started with result:", result);

      // Create a new task in our local state
      const newTask: Task = {
        id: result.taskId,
        status: result.status as TaskStatus,
        progress: 0,
        totalItems: selectedItemsData.length,
        completedItems: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        message: result.message,
      };

      // Add task to tasks list
      setTasks((prev) => [newTask, ...prev]);

      // Start polling for this task
      setActivePollTaskIds((prev) => [...prev, result.taskId]);

      toast.success(
        `Batch generation started for ${selectedItemsData.length} items`
      );

      setShowBatchDialog(false);
      setSelectedItemDetails(null);
      setActiveTab("items");
    } catch (error) {
      console.error("Error starting batch generation:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not start batch generation"
      );
    } finally {
      setIsGenerating(false);
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

  // Add/update utility functions for metric color coding
  const getMetricColor = (value: number, type: string) => {
    if (type === "difficulty") {
      // Lower difficulty is better
      if (value < 30) return "bg-green-100 text-green-800";
      if (value < 60) return "bg-amber-100 text-amber-800";
      return "bg-red-100 text-red-800";
    }

    if (type === "competition") {
      // Lower competition is better
      if (value < 0.3) return "bg-green-100 text-green-800";
      if (value < 0.7) return "bg-amber-100 text-amber-800";
      return "bg-red-100 text-red-800";
    }

    if (type === "efficiency") {
      // Higher efficiency is better
      if (value > 0.7) return "bg-green-100 text-green-800";
      if (value > 0.4) return "bg-amber-100 text-amber-800";
      return "bg-red-100 text-red-800";
    }

    return "bg-gray-100 text-gray-800";
  };

  const getBarColor = (value: number) => {
    if (value > 0.7) return "bg-gradient-to-r from-green-500 to-green-600";
    if (value > 0.4) return "bg-gradient-to-r from-amber-500 to-amber-600";
    return "bg-gradient-to-r from-red-500 to-red-600";
  };

  return (
    <div className="mx-auto px-8 no-scrollbar">
      {!showMainDetails ? (
        <div className="flex flex-col gap-6">
          {/* Task Manager - Show only if there are tasks */}
          {tasks.length > 0 && (
            <TaskManager
              tasks={tasks}
              onRemoveTask={handleRemoveTask}
              onRefreshList={fetchResearchItems}
            />
          )}

          <div className="no-scrollbar">
            <div className="flex justify-between gap-2 pb-2">
              <div className="flex flex-row items-center gap-2">
                <Badge variant="outline" className="bg-[#4EBE96]/20 hover:bg-[#4EBE96]/30 rounded-none gap-2">
                  Display Advertisements
                </Badge>
                <Badge variant="outline" className="rounded-none gap-2 bg-primary/10 text-primary">
                  Ad2Keyword
                </Badge>
              </div>
              <Badge variant="outline" className="rounded-none gap-2 bg-foreground/10 text-primary">
                <LibraryBig className="h-3 w-3" />
                {researchItems.length} total items with{" "}
                {researchItems.reduce(
                  (sum, item) => sum + (item.variant_count || 0),
                  0
                )}{" "}
                keyword variants
              </Badge>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <Input
                  placeholder="Search research items..."
                  className="h-9 max-w-md rounded-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/keywords")}
                    className="rounded-none"
                  >
                    <SwatchBook className="h-4 w-4" /> New Variant
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fetchResearchItems()}
                    disabled={isLoading}
                    className="rounded-none"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isLoading ? "animate-spin" : ""
                        }`}
                    />
                    {isLoading ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowBatchDialog(true)}
                    disabled={selectedItems.length === 0}
                    className="rounded-none"
                  >
                    <RefreshCw className="h-3 w-3" /> Batch Generate
                  </Button>
                </div>
              </div>

              <div className="rounded-none border">
                <Table className="rounded-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] px-4">
                        <Checkbox
                          checked={
                            selectedItems.length === filteredItems.length &&
                            filteredItems.length > 0
                          }
                          onCheckedChange={toggleAllItems}
                          disabled={filteredItems.length === 0}
                        />
                      </TableHead>
                      <TableHead className="w-[30px] px-2"></TableHead>
                      <TableHead className="px-4">Preview</TableHead>
                      <TableHead className="px-4">Intent Summary</TableHead>
                      <TableHead className="px-4">Description</TableHead>
                      <TableHead className="text-right px-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <>
                        {[...Array(5)].map((_, i) => (
                          <TableRow key={`loading-row-${i}`}>
                            <TableCell className="w-[30px] px-2">
                              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                            </TableCell>
                            <TableCell className="w-[30px] px-2">
                              <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex items-center space-x-4">
                                <div className="h-12 w-12 rounded-sm bg-muted animate-pulse" />
                                <div className="space-y-2">
                                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                                  <div className="h-3 w-20 bg-muted/50 rounded animate-pulse" />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="space-y-2">
                                <div className="h-4 w-full max-w-[180px] bg-muted rounded animate-pulse" />
                                <div className="h-3 w-3/4 bg-muted/50 rounded animate-pulse" />
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="space-y-2">
                                <div className="h-4 w-full max-w-[220px] bg-muted rounded animate-pulse" />
                                <div className="h-3 w-1/2 bg-muted/50 rounded animate-pulse" />
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-4">
                              <div className="flex justify-end gap-2">
                                <div className="h-8 w-8 rounded-sm bg-muted animate-pulse" />
                                <div className="h-8 w-8 rounded-sm bg-muted animate-pulse" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ) : loadError ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">
                          <div className="flex flex-col justify-center items-center gap-3">
                            <p className="text-destructive font-medium">
                              Error loading data
                            </p>
                            <p className="text-muted-foreground">{loadError}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchResearchItems()}
                            >
                              Try Again
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">
                          No research items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {filteredItems.map((item, index) => (
                          <React.Fragment key={index}>
                            <TableRow
                              className={item.expanded ? "border-b-0" : ""}
                            >
                              <TableCell className="px-4">
                                <Checkbox
                                  checked={selectedItems.includes(item.id)}
                                  onCheckedChange={() =>
                                    toggleItemSelection(item.id)
                                  }
                                />
                              </TableCell>
                              <TableCell className="px-2">
                                {item.variant_count > 0 ? (
                                  <div className="flex items-center space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 mr-1"
                                      onClick={() => toggleRowExpansion(index)}
                                    >
                                      {item.expanded ? (
                                        <FolderOpen className="h-4 w-4" />
                                      ) : (
                                        <FolderClosed className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="outline"
                                          className="bg-primary/10 text-primary rounded-none border-primary/20 text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer flex items-center gap-1"
                                          onClick={() =>
                                            toggleRowExpansion(index)
                                          }
                                        >
                                          <Sparkles className="h-3 w-3" />
                                          {item.variant_count} variants
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          This item has {item.variant_count}{" "}
                                          keyword variants available. Click to
                                          view.
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                ) : (
                                  <div className="flex items-center h-6">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 rounded-none text-xs flex items-center gap-1 text-emerald-700 hover:bg-emerald-800/40 hover:text-white"
                                          onClick={() => generateVariants(item)}
                                          disabled={item.isGeneratingVariants}
                                        >
                                          {item.isGeneratingVariants ? (
                                            <>
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                              Generating...
                                            </>
                                          ) : (
                                            <>
                                              <SwatchBook className="h-3 w-3" />
                                              Generate Variants
                                            </>
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>
                                          Generate keyword variants for this
                                          item
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-3">
                                <AdImage
                                  src={
                                    item.mr_image_url ||
                                    item.image_url ||
                                    item.li_preview_url
                                  }
                                  size={50}
                                  alt={`Ad preview for ${item.title || "unnamed item"
                                    }`}
                                />
                              </TableCell>
                              <TableCell className="px-4">
                                <div className="max-w-md line-clamp-1">
                                  <HoverCard>
                                    <HoverCardTrigger asChild>
                                      <span className="cursor-help">
                                        {item.mr_intent_summary ||
                                          item.intent_summary ||
                                          "No summary available"}
                                      </span>
                                    </HoverCardTrigger>
                                    <HoverCardContent className="w-80 p-4">
                                      <p className="text-sm">
                                        {item.mr_intent_summary ||
                                          item.intent_summary ||
                                          "No summary available"}
                                      </p>
                                    </HoverCardContent>
                                  </HoverCard>
                                </div>
                              </TableCell>
                              <TableCell className="px-4">
                                <div className="max-w-md line-clamp-1">
                                  {item.description || "No description"}
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-4">
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => viewItemDetails(item, false)}
                                  >
                                    <EllipsisVertical className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {item.expanded &&
                              !item.isLoadingVariants &&
                              item.variants &&
                              item.variants.length > 0 && (
                                <TableRow
                                  key={`${item.id}-expanded`}
                                  className="bg-gradient-to-b from-muted/30 to-muted/60"
                                >
                                  <TableCell colSpan={6} className="p-0">
                                    <div className="p-0">
                                      {/* <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-medium">
                                          <span className="text-muted-foreground mr-1">
                                            Variants for
                                          </span>
                                          <span className="font-semibold">
                                            {item.li_name ||
                                              item.keyword ||
                                              "Untitled Item"}
                                          </span>
                                        </h4>
                                        <Badge
                                          variant="outline"
                                          className="bg-primary/10 text-primary rounded-none border-primary/20 text-xs"
                                        >
                                          {item.variants.length} results
                                        </Badge>
                                      </div> */}

                                      {/* Enhanced variant table */}
                                      <div className="rounded-none border overflow-hidden shadow-sm">
                                        <Table>
                                          <TableHeader>
                                            <TableRow className="bg-muted/50">
                                              <TableHead className="text-xs font-medium">Keyword</TableHead>
                                              <TableHead className="text-xs font-medium">Source</TableHead>
                                              <TableHead className="text-xs font-medium">
                                                Search Volume
                                              </TableHead>
                                              <TableHead className="text-xs font-medium">CPC</TableHead>
                                              <TableHead className="text-xs font-medium">Metrics</TableHead>
                                              <TableHead className="text-xs font-medium">Efficiency</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {item.variants.map(
                                              (variant, variantIndex) => (
                                                <TableRow
                                                  key={variantIndex}
                                                  className="hover:bg-muted/30 transition-colors border-b border-muted/50"
                                                >
                                                  <TableCell className="font-medium">
                                                    <HoverCard>
                                                      <HoverCardTrigger asChild>
                                                        <span className="cursor-help border-b border-dotted border-muted-foreground/40 text-xs">
                                                          {variant.keyword ||
                                                            "—"}
                                                        </span>
                                                      </HoverCardTrigger>
                                                      <HoverCardContent className="w-80 rounded-none">
                                                        <div className="space-y-2">
                                                          <h4 className="text-sm font-semibold">
                                                            {variant.keyword}
                                                          </h4>
                                                          <p className="text-xs text-muted-foreground">
                                                            {variant.explanation ||
                                                              "No explanation available for this keyword variant."}
                                                          </p>
                                                          {variant.similar_keywords &&
                                                            variant
                                                              .similar_keywords
                                                              .length > 0 && (
                                                              <div className="mt-2">
                                                                <h5 className="text-xs font-medium mb-1 text-muted-foreground">
                                                                  Similar
                                                                  Keywords:
                                                                </h5>
                                                                <div className="flex flex-wrap gap-1">
                                                                  {variant.similar_keywords
                                                                    .slice(0, 3)
                                                                    .map(
                                                                      (
                                                                        sk: Keyword,
                                                                        sk_index: number
                                                                      ) => (
                                                                        <Badge
                                                                          key={
                                                                            sk_index
                                                                          }
                                                                          variant="outline"
                                                                          className="text-xs bg-primary/10 text-primary rounded-none border-primary/20"
                                                                        >
                                                                          {
                                                                            sk.keyword
                                                                          }
                                                                        </Badge>
                                                                      )
                                                                    )}
                                                                </div>
                                                              </div>
                                                            )}
                                                        </div>
                                                      </HoverCardContent>
                                                    </HoverCard>
                                                  </TableCell>
                                                  <TableCell>
                                                    <Badge
                                                      variant="outline"
                                                      className={
                                                        variant.source ===
                                                          "generated"
                                                          ? "bg-primary/10 text-primary rounded-none border-primary/20 text-xs"
                                                          : "bg-green-500/10 text-green-700 rounded-none border-green-200/20 text-xs"
                                                      }
                                                    >
                                                      {variant.source}
                                                    </Badge>
                                                  </TableCell>
                                                  <TableCell>
                                                    <div className="flex items-center">
                                                      <span className="mr-2 text-xs">
                                                        {formatMetric(
                                                          variant.search_volume,
                                                          "volume"
                                                        )}
                                                      </span>
                                                      <div className="h-1.5 w-16 bg-muted rounded-none overflow-hidden">
                                                        <div
                                                          className="h-full bg-primary"
                                                          style={{
                                                            width: `${Math.min(
                                                              100,
                                                              (variant.search_volume /
                                                                1000) *
                                                              100
                                                            )}%`,
                                                          }}
                                                        />
                                                      </div>
                                                    </div>
                                                  </TableCell>
                                                  <TableCell>
                                                    <span className="font-medium text-xs">
                                                      $
                                                      {formatMetric(
                                                        variant.cpc,
                                                        "cpc"
                                                      )}
                                                    </span>
                                                  </TableCell>
                                                  <TableCell>
                                                    <div className="flex gap-3">
                                                      <div className="flex flex-col items-center">
                                                        <span className="text-xs text-muted-foreground mb-1">
                                                          Difficulty
                                                        </span>
                                                        <div
                                                          className="h-5 min-w-[20px] px-1.5 rounded-none flex items-center justify-center text-xs font-medium"
                                                          style={{
                                                            backgroundColor: variant.keyword_difficulty < 30
                                                              ? 'rgba(74, 222, 128, 0.1)'
                                                              : variant.keyword_difficulty < 70
                                                                ? 'rgba(250, 204, 21, 0.1)'
                                                                : 'rgba(248, 113, 113, 0.1)',
                                                            color: variant.keyword_difficulty < 30
                                                              ? 'rgb(21, 128, 61)'
                                                              : variant.keyword_difficulty < 70
                                                                ? 'rgb(161, 98, 7)'
                                                                : 'rgb(185, 28, 28)'
                                                          }}
                                                        >
                                                          {Math.round(
                                                            variant.keyword_difficulty
                                                          )}
                                                        </div>
                                                      </div>
                                                      <div className="flex flex-col items-center">
                                                        <span className="text-xs text-muted-foreground mb-1">
                                                          Comp
                                                        </span>
                                                        <div
                                                          className="h-5 min-w-[20px] px-1.5 rounded-none flex items-center justify-center text-xs font-medium"
                                                          style={{
                                                            backgroundColor: variant.competition_percentage < 0.3
                                                              ? 'rgba(74, 222, 128, 0.1)'
                                                              : variant.competition_percentage < 0.7
                                                                ? 'rgba(250, 204, 21, 0.1)'
                                                                : 'rgba(248, 113, 113, 0.1)',
                                                            color: variant.competition_percentage < 0.3
                                                              ? 'rgb(21, 128, 61)'
                                                              : variant.competition_percentage < 0.7
                                                                ? 'rgb(161, 98, 7)'
                                                                : 'rgb(185, 28, 28)'
                                                          }}
                                                        >
                                                          {Math.round(
                                                            variant.competition_percentage *
                                                            100
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </TableCell>
                                                  <TableCell>
                                                    <div className="flex items-center gap-2">
                                                      <div
                                                        className="h-5 min-w-[2rem] px-1.5 rounded-none flex items-center justify-center text-xs font-medium"
                                                        style={{
                                                          backgroundColor: variant.efficiency_index > 0.7
                                                            ? 'rgba(74, 222, 128, 0.1)'
                                                            : variant.efficiency_index > 0.3
                                                              ? 'rgba(250, 204, 21, 0.1)'
                                                              : 'rgba(248, 113, 113, 0.1)',
                                                          color: variant.efficiency_index > 0.7
                                                            ? 'rgb(21, 128, 61)'
                                                            : variant.efficiency_index > 0.3
                                                              ? 'rgb(161, 98, 7)'
                                                              : 'rgb(185, 28, 28)'
                                                        }}
                                                      >
                                                        {(
                                                          variant.efficiency_index *
                                                          100
                                                        ).toFixed(0)}
                                                      </div>
                                                      <div className="h-1.5 w-16 bg-muted rounded-none overflow-hidden">
                                                        <div
                                                          style={{
                                                            height: '100%',
                                                            width: `${variant.efficiency_index * 100}%`,
                                                            backgroundColor: variant.efficiency_index > 0.7
                                                              ? 'rgb(74, 222, 128)'
                                                              : variant.efficiency_index > 0.3
                                                                ? 'rgb(250, 204, 21)'
                                                                : 'rgb(248, 113, 113)'
                                                          }}
                                                        />
                                                      </div>
                                                    </div>
                                                  </TableCell>
                                                </TableRow>
                                              )
                                            )}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            {item.expanded && item.isLoadingVariants && (
                              <TableRow
                                key={`${item.id}-loading`}
                                className="bg-muted/50"
                              >
                                <TableCell colSpan={6}>
                                  <div className="py-4 px-6 space-y-4">
                                    {/* Variant header skeleton */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="h-5 w-24 bg-muted rounded-sm animate-pulse" />
                                        <div className="h-5 w-16 bg-primary/10 rounded-sm animate-pulse" />
                                      </div>
                                      <div className="h-8 w-20 bg-muted rounded-sm animate-pulse" />
                                    </div>

                                    {/* Variants skeleton */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {[...Array(2)].map((_, i) => (
                                        <div key={i} className="border bg-muted/30 p-3 space-y-3">
                                          <div className="flex items-center justify-between">
                                            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                                            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                                          </div>
                                          <div className="space-y-2">
                                            <div className="h-4 w-full bg-muted rounded animate-pulse" />
                                            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                                          </div>
                                          <div className="flex flex-wrap gap-2 mt-3">
                                            <div className="h-6 w-16 bg-muted/70 rounded-sm animate-pulse" />
                                            <div className="h-6 w-20 bg-muted/70 rounded-sm animate-pulse" />
                                            <div className="h-6 w-24 bg-muted/70 rounded-sm animate-pulse" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            {item.expanded &&
                              !item.isLoadingVariants &&
                              (!item.variants ||
                                item.variants.length === 0) && (
                                <TableRow
                                  key={`${item.id}-expanded-empty`}
                                  className="bg-muted/50"
                                >
                                  <TableCell
                                    colSpan={6}
                                    className="text-center py-4"
                                  >
                                    No variants data available
                                  </TableCell>
                                </TableRow>
                              )}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Research Item Details
              </h1>
              <p className="text-muted-foreground">
                Detailed view of research data and insights
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowMainDetails(false)}>
              Back to List
            </Button>
          </div>

          <InnerCard>
            <InnerCardContent className="p-6">
              {selectedItemDetails && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">
                      {selectedItemDetails.li_name || "Item"}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {/* Image Preview Card */}
                    <InnerCard>
                      <InnerCardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                          <div className="flex-shrink-0">
                            <h4 className="font-medium mb-3">Ad Preview</h4>
                            <AdImage
                              src={
                                selectedItemDetails.mr_image_url ||
                                selectedItemDetails.li_preview_url
                              }
                              size={200}
                              alt={`Ad preview for ${selectedItemDetails.li_name || "unnamed item"
                                }`}
                            />
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-medium mb-3">Intent Summary</h4>
                            <div className="bg-muted/50 p-4 rounded-none">
                              <p className="text-sm">
                                {selectedItemDetails.mr_intent_summary ||
                                  selectedItemDetails.intent_summary ||
                                  "No intent summary available"}
                              </p>
                            </div>

                            {selectedItemDetails.mr_buying_stage && (
                              <div className="mt-4">
                                <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                  Buying Stage
                                </h5>
                                <Badge
                                  variant="secondary"
                                  className="text-base px-3 py-1"
                                >
                                  {selectedItemDetails.mr_buying_stage}
                                </Badge>
                              </div>
                            )}

                            {selectedItemDetails.description && (
                              <div className="mt-4">
                                <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                  Description
                                </h5>
                                <div className="bg-muted/30 p-3 rounded-none">
                                  <p className="text-sm">
                                    {selectedItemDetails.description}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </InnerCardContent>
                    </InnerCard>

                    {/* Target Audience */}
                    {selectedItemDetails.mr_target_audience &&
                      selectedItemDetails.mr_target_audience.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">
                              Target Audience
                            </h4>
                            <div className="space-y-3">
                              {selectedItemDetails.mr_target_audience.map(
                                (audience: TargetAudience, index: number) => (
                                  <TargetAudienceCard
                                    key={`audience-${index}`}
                                    audience={audience}
                                  />
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Pain Points */}
                    {selectedItemDetails.mr_pain_points &&
                      selectedItemDetails.mr_pain_points.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Pain Points</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedItemDetails.mr_pain_points.map(
                                (pain: string, index: number) => (
                                  <Badge
                                    key={`pain-${index}`}
                                    variant="destructive"
                                    className="text-sm"
                                  >
                                    {pain}
                                  </Badge>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Key Features */}
                    {selectedItemDetails.mr_key_features &&
                      selectedItemDetails.mr_key_features.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Key Features</h4>
                            <div className="space-y-3">
                              {selectedItemDetails.mr_key_features.map(
                                (feature, index) => (
                                  <FeatureCard
                                    key={`feature-${index}`}
                                    feature={feature}
                                  />
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Competitive Advantages */}
                    {selectedItemDetails.mr_competitive_advantages &&
                      selectedItemDetails.mr_competitive_advantages.length >
                      0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">
                              Competitive Advantages
                            </h4>
                            <div className="space-y-2">
                              {selectedItemDetails.mr_competitive_advantages.map(
                                (adv, index) => (
                                  <div
                                    key={`adv-${index}`}
                                    className="bg-green-50 dark:bg-green-950/20 p-3 rounded-none border border-green-200 dark:border-green-900"
                                  >
                                    <p className="text-sm text-green-800 dark:text-green-300">
                                      {adv}
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Keywords */}
                    {selectedItemDetails.mr_keywords &&
                      selectedItemDetails.mr_keywords.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Keywords</h4>

                            <div className="space-y-4">
                              {(() => {
                                // Group keywords by intent
                                const keywordsByIntent: Record<
                                  string,
                                  Keyword[]
                                > = {};
                                selectedItemDetails.mr_keywords.forEach(
                                  (kw: Keyword) => {
                                    if (
                                      !keywordsByIntent[kw.intent_reflected]
                                    ) {
                                      keywordsByIntent[kw.intent_reflected] =
                                        [];
                                    }
                                    keywordsByIntent[kw.intent_reflected].push(
                                      kw
                                    );
                                  }
                                );

                                return Object.entries(keywordsByIntent).map(
                                  ([intent, keywords]) => (
                                    <div key={intent} className="mb-4">
                                      <h5 className="text-sm font-medium text-primary mb-2 capitalize">
                                        {intent}
                                      </h5>
                                      <div className="flex flex-wrap gap-2">
                                        {keywords.map((kw, idx) => {
                                          // Calculate color based on likelihood score
                                          const getColor = (score: number) => {
                                            if (score >= 0.8)
                                              return "border-green-500 text-green-700 dark:text-green-400 dark:border-green-700";
                                            if (score >= 0.7)
                                              return "border-yellow-500 text-yellow-700 dark:text-yellow-400 dark:border-yellow-700";
                                            return "border-orange-500 text-orange-700 dark:text-orange-400 dark:border-orange-700";
                                          };

                                          return (
                                            <div
                                              key={idx}
                                              className={`text-xs border rounded-full px-3 py-1 ${getColor(
                                                kw.likelihood_score
                                              )} bg-background`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <span>{kw.keyword}</span>
                                                <span className="font-semibold">
                                                  {(
                                                    kw.likelihood_score * 100
                                                  ).toFixed(0)}
                                                  %
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )
                                );
                              })()}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Perplexity Insights */}
                    {selectedItemDetails.mr_perplexity_insights && (
                      <InnerCard>
                        <InnerCardContent className="p-4">
                          <h4 className="font-medium mb-4">
                            Perplexity Insights
                          </h4>
                          <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-none dark:prose-invert">
                            <ReactMarkdown>
                              {selectedItemDetails.mr_perplexity_insights}
                            </ReactMarkdown>
                          </div>
                        </InnerCardContent>
                      </InnerCard>
                    )}

                    {/* Headline Improvements */}
                    {selectedItemDetails.mr_new_headlines &&
                      selectedItemDetails.mr_new_headlines.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">
                              Headline Improvements
                            </h4>

                            <div className="space-y-4">
                              {selectedItemDetails.mr_new_headlines.map(
                                (headline, index) => (
                                  <div
                                    key={index}
                                    className="rounded-lg border p-4 mb-3 bg-background"
                                  >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="p-3 bg-muted/50 rounded-none">
                                        <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                          Original
                                        </h5>
                                        <p className="text-base font-medium">
                                          {headline.original}
                                        </p>
                                      </div>

                                      <div className="p-3 bg-primary/5 rounded-none border-l-4 border-primary">
                                        <h5 className="text-sm font-medium text-primary mb-1">
                                          Improved
                                        </h5>
                                        <p className="text-base font-medium">
                                          {headline.improved}
                                        </p>
                                      </div>
                                    </div>

                                    {headline.improvements &&
                                      headline.improvements.length > 0 && (
                                        <div className="mt-3">
                                          <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                            Improvements
                                          </h5>
                                          <ul className="list-disc pl-5 text-sm space-y-1">
                                            {headline.improvements.map(
                                              (improvement, i) => (
                                                <li key={i}>{improvement}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}

                                    {headline.expected_impact &&
                                      headline.expected_impact.length > 0 && (
                                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 rounded-none border border-green-200 dark:border-green-900">
                                          <h5 className="text-sm font-medium text-green-800 dark:text-green-400 mb-1">
                                            Expected Impact
                                          </h5>
                                          <p className="text-sm text-green-700 dark:text-green-300">
                                            {headline.expected_impact[0]}
                                          </p>
                                        </div>
                                      )}
                                  </div>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Citations */}
                    {selectedItemDetails.mr_citations &&
                      selectedItemDetails.mr_citations.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Citations</h4>
                            <div className="space-y-2">
                              {selectedItemDetails.mr_citations.map(
                                (citation, index) => (
                                  <div
                                    key={`citation-${index}`}
                                    className="flex items-center gap-2"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                    <a
                                      href={citation}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-500 hover:underline truncate"
                                    >
                                      {citation}
                                    </a>
                                  </div>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Library Item Data */}
                    <InnerCard>
                      <InnerCardContent className="p-4">
                        <h4 className="font-medium mb-4">Library Item Data</h4>
                        <div className="space-y-4">
                          {/* Features */}
                          {selectedItemDetails.li_features &&
                            selectedItemDetails.li_features.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                  Features
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedItemDetails.li_features.map(
                                    (feature, index) => (
                                      <Badge
                                        key={`feature-${index}`}
                                        variant="outline"
                                      >
                                        {feature}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Sentiment Tones */}
                          {selectedItemDetails.li_sentiment_tones &&
                            selectedItemDetails.li_sentiment_tones.length >
                            0 && (
                              <div>
                                <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                  Sentiment Tones
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedItemDetails.li_sentiment_tones.map(
                                    (tone, index) => (
                                      <Badge
                                        key={`tone-${index}`}
                                        variant="secondary"
                                      >
                                        {tone}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          <div>
                            <h5 className="text-sm font-medium text-muted-foreground mb-1">
                              Avg Sentiment Confidence
                            </h5>
                            <p>
                              {selectedItemDetails.li_avg_sentiment_confidence
                                ? formatSentimentConfidence(
                                  selectedItemDetails.li_avg_sentiment_confidence
                                )
                                : "None"}
                            </p>
                          </div>
                        </div>
                      </InnerCardContent>
                    </InnerCard>
                  </div>
                </div>
              )}
            </InnerCardContent>
          </InnerCard>
        </div>
      )}

      {/* Batch Generation Dialog */}
      <Dialog
        open={showBatchDialog}
        onOpenChange={(open) => {
          setShowBatchDialog(open);
          if (!open) {
            setSelectedItemDetails(null);
            setActiveTab("items");
          }
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch Generate Variants</DialogTitle>
            <DialogDescription>
              {selectedItems.length} item(s) selected for batch generation
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="items">Selected Items</TabsTrigger>
              <TabsTrigger value="details" disabled={!selectedItemDetails}>
                Item Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[450px] overflow-y-auto p-2">
                {filteredItems
                  .filter((item) => selectedItems.includes(item.id))
                  .map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-none p-3 flex flex-col space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-center mb-2">
                        <AdImage
                          src={
                            item.mr_image_url ||
                            item.image_url ||
                            item.li_preview_url
                          }
                          size={60}
                          alt={`Ad preview for ${item.title || "unnamed item"}`}
                        />
                      </div>
                      <h4 className="font-medium text-sm truncate">
                        {item.li_name ||
                          item.mr_intent_summary?.substring(0, 30) ||
                          `Item ${item.id.substring(0, 8)}`}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.mr_intent_summary ||
                          item.intent_summary ||
                          "No summary"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-auto"
                        onClick={() => viewItemDetails(item, true)}
                      >
                        View Details
                      </Button>
                    </div>
                  ))}
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBatchDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => onBatchGenerate()}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                      Generating...
                    </>
                  ) : (
                    "Generate Variants"
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              {selectedItemDetails && (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">
                      Details for {selectedItemDetails.li_name || "Item"}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("items")}
                    >
                      Back to Items
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {/* Image Preview Card */}
                    <InnerCard>
                      <InnerCardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                          <div className="flex-shrink-0">
                            <h4 className="font-medium mb-3">Ad Preview</h4>
                            <AdImage
                              src={
                                selectedItemDetails.mr_image_url ||
                                selectedItemDetails.li_preview_url
                              }
                              size={200}
                              alt={`Ad preview for ${selectedItemDetails.li_name || "unnamed item"
                                }`}
                            />
                          </div>
                          <div className="flex-grow">
                            <h4 className="font-medium mb-3">Intent Summary</h4>
                            <div className="bg-muted/50 p-4 rounded-none">
                              <p className="text-sm">
                                {selectedItemDetails.mr_intent_summary ||
                                  selectedItemDetails.intent_summary ||
                                  "No intent summary available"}
                              </p>
                            </div>

                            {selectedItemDetails.mr_buying_stage && (
                              <div className="mt-4">
                                <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                  Buying Stage
                                </h5>
                                <Badge
                                  variant="secondary"
                                  className="text-base px-3 py-1"
                                >
                                  {selectedItemDetails.mr_buying_stage}
                                </Badge>
                              </div>
                            )}

                            {selectedItemDetails.description && (
                              <div className="mt-4">
                                <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                  Description
                                </h5>
                                <div className="bg-muted/30 p-3 rounded-none">
                                  <p className="text-sm">
                                    {selectedItemDetails.description}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </InnerCardContent>
                    </InnerCard>

                    {/* Target Audience */}
                    {selectedItemDetails.mr_target_audience &&
                      selectedItemDetails.mr_target_audience.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">
                              Target Audience
                            </h4>
                            <div className="space-y-3">
                              {selectedItemDetails.mr_target_audience.map(
                                (audience: TargetAudience, index: number) => (
                                  <TargetAudienceCard
                                    key={`audience-${index}`}
                                    audience={audience}
                                  />
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Pain Points */}
                    {selectedItemDetails.mr_pain_points &&
                      selectedItemDetails.mr_pain_points.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Pain Points</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedItemDetails.mr_pain_points.map(
                                (pain: string, index: number) => (
                                  <Badge
                                    key={`pain-${index}`}
                                    variant="destructive"
                                    className="text-sm"
                                  >
                                    {pain}
                                  </Badge>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Key Features */}
                    {selectedItemDetails.mr_key_features &&
                      selectedItemDetails.mr_key_features.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Key Features</h4>
                            <div className="space-y-3">
                              {selectedItemDetails.mr_key_features.map(
                                (feature, index) => (
                                  <FeatureCard
                                    key={`feature-${index}`}
                                    feature={feature}
                                  />
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Competitive Advantages */}
                    {selectedItemDetails.mr_competitive_advantages &&
                      selectedItemDetails.mr_competitive_advantages.length >
                      0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">
                              Competitive Advantages
                            </h4>
                            <div className="space-y-2">
                              {selectedItemDetails.mr_competitive_advantages.map(
                                (adv, index) => (
                                  <div
                                    key={`adv-${index}`}
                                    className="bg-green-50 dark:bg-green-950/20 p-3 rounded-none border border-green-200 dark:border-green-900"
                                  >
                                    <p className="text-sm text-green-800 dark:text-green-300">
                                      {adv}
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Keywords */}
                    {selectedItemDetails.mr_keywords &&
                      selectedItemDetails.mr_keywords.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Keywords</h4>

                            <div className="space-y-4">
                              {(() => {
                                // Group keywords by intent
                                const keywordsByIntent: Record<
                                  string,
                                  Keyword[]
                                > = {};
                                selectedItemDetails.mr_keywords.forEach(
                                  (kw: Keyword) => {
                                    if (
                                      !keywordsByIntent[kw.intent_reflected]
                                    ) {
                                      keywordsByIntent[kw.intent_reflected] =
                                        [];
                                    }
                                    keywordsByIntent[kw.intent_reflected].push(
                                      kw
                                    );
                                  }
                                );

                                return Object.entries(keywordsByIntent).map(
                                  ([intent, keywords]) => (
                                    <div key={intent} className="mb-4">
                                      <h5 className="text-sm font-medium text-primary mb-2 capitalize">
                                        {intent}
                                      </h5>
                                      <div className="flex flex-wrap gap-2">
                                        {keywords.map((kw, idx) => {
                                          // Calculate color based on likelihood score
                                          const getColor = (score: number) => {
                                            if (score >= 0.8)
                                              return "border-green-500 text-green-700 dark:text-green-400 dark:border-green-700";
                                            if (score >= 0.7)
                                              return "border-yellow-500 text-yellow-700 dark:text-yellow-400 dark:border-yellow-700";
                                            return "border-orange-500 text-orange-700 dark:text-orange-400 dark:border-orange-700";
                                          };

                                          return (
                                            <div
                                              key={idx}
                                              className={`text-xs border rounded-full px-3 py-1 ${getColor(
                                                kw.likelihood_score
                                              )} bg-background`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <span>{kw.keyword}</span>
                                                <span className="font-semibold">
                                                  {(
                                                    kw.likelihood_score * 100
                                                  ).toFixed(0)}
                                                  %
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )
                                );
                              })()}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Perplexity Insights */}
                    {selectedItemDetails.mr_perplexity_insights && (
                      <InnerCard>
                        <InnerCardContent className="p-4">
                          <h4 className="font-medium mb-4">
                            Perplexity Insights
                          </h4>
                          <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-none dark:prose-invert">
                            <ReactMarkdown>
                              {selectedItemDetails.mr_perplexity_insights}
                            </ReactMarkdown>
                          </div>
                        </InnerCardContent>
                      </InnerCard>
                    )}

                    {/* Headline Improvements */}
                    {selectedItemDetails.mr_new_headlines &&
                      selectedItemDetails.mr_new_headlines.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">
                              Headline Improvements
                            </h4>

                            <div className="space-y-4">
                              {selectedItemDetails.mr_new_headlines.map(
                                (headline, index) => (
                                  <div
                                    key={index}
                                    className="rounded-lg border p-4 mb-3 bg-background"
                                  >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="p-3 bg-muted/50 rounded-none">
                                        <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                          Original
                                        </h5>
                                        <p className="text-base font-medium">
                                          {headline.original}
                                        </p>
                                      </div>

                                      <div className="p-3 bg-primary/5 rounded-none border-l-4 border-primary">
                                        <h5 className="text-sm font-medium text-primary mb-1">
                                          Improved
                                        </h5>
                                        <p className="text-base font-medium">
                                          {headline.improved}
                                        </p>
                                      </div>
                                    </div>

                                    {headline.improvements &&
                                      headline.improvements.length > 0 && (
                                        <div className="mt-3">
                                          <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                            Improvements
                                          </h5>
                                          <ul className="list-disc pl-5 text-sm space-y-1">
                                            {headline.improvements.map(
                                              (improvement, i) => (
                                                <li key={i}>{improvement}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}

                                    {headline.expected_impact &&
                                      headline.expected_impact.length > 0 && (
                                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/20 rounded-none border border-green-200 dark:border-green-900">
                                          <h5 className="text-sm font-medium text-green-800 dark:text-green-400 mb-1">
                                            Expected Impact
                                          </h5>
                                          <p className="text-sm text-green-700 dark:text-green-300">
                                            {headline.expected_impact[0]}
                                          </p>
                                        </div>
                                      )}
                                  </div>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Citations */}
                    {selectedItemDetails.mr_citations &&
                      selectedItemDetails.mr_citations.length > 0 && (
                        <InnerCard>
                          <InnerCardContent className="p-4">
                            <h4 className="font-medium mb-4">Citations</h4>
                            <div className="space-y-2">
                              {selectedItemDetails.mr_citations.map(
                                (citation, index) => (
                                  <div
                                    key={`citation-${index}`}
                                    className="flex items-center gap-2"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                    <a
                                      href={citation}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-blue-500 hover:underline truncate"
                                    >
                                      {citation}
                                    </a>
                                  </div>
                                )
                              )}
                            </div>
                          </InnerCardContent>
                        </InnerCard>
                      )}

                    {/* Library Item Data */}
                    <InnerCard>
                      <InnerCardContent className="p-4">
                        <h4 className="font-medium mb-4">Library Item Data</h4>
                        <div className="space-y-4">
                          {/* Features */}
                          {selectedItemDetails.li_features &&
                            selectedItemDetails.li_features.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                  Features
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedItemDetails.li_features.map(
                                    (feature, index) => (
                                      <Badge
                                        key={`feature-${index}`}
                                        variant="outline"
                                      >
                                        {feature}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Sentiment Tones */}
                          {selectedItemDetails.li_sentiment_tones &&
                            selectedItemDetails.li_sentiment_tones.length >
                            0 && (
                              <div>
                                <h5 className="text-sm font-medium text-muted-foreground mb-1">
                                  Sentiment Tones
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedItemDetails.li_sentiment_tones.map(
                                    (tone, index) => (
                                      <Badge
                                        key={`tone-${index}`}
                                        variant="secondary"
                                      >
                                        {tone}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                          <div>
                            <h5 className="text-sm font-medium text-muted-foreground mb-1">
                              Avg Sentiment Confidence
                            </h5>
                            <p>
                              {selectedItemDetails.li_avg_sentiment_confidence
                                ? formatSentimentConfidence(
                                  selectedItemDetails.li_avg_sentiment_confidence
                                )
                                : "None"}
                            </p>
                          </div>
                        </div>
                      </InnerCardContent>
                    </InnerCard>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("items")}
                    >
                      Back to Items
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
