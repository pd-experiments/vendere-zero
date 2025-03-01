"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

// Type for the RPC function result
type AdVariantItem = {
  mr_id: string;
  mr_user_id: string;
  mr_image_url: string;
  mr_created_at: string;
  mr_intent_summary: string;
  mr_target_audience: Record<string, unknown>;
  mr_pain_points: Record<string, unknown>;
  mr_buying_stage: string;
  mr_key_features: Record<string, unknown>;
  mr_competitive_advantages: Record<string, unknown>;
  mr_perplexity_insights: string;
  mr_citations: string[];
  mr_keywords: {
    keyword: string;
    intent_reflected: string;
    likelihood_score: number;
  }[];
  mr_original_headlines: Record<string, unknown>[];
  mr_new_headlines: Record<string, unknown>[];
  li_id: string;
  li_type: string;
  li_name: string;
  li_description: string;
  li_user_id: string;
  li_created_at: string;
  li_item_id: string;
  li_features: string[];
  li_sentiment_tones: string[];
  li_avg_sentiment_confidence: number;
  li_preview_url: string;
};

// Component to handle ad image display with ad blocker consideration
const AdImage = ({
  src,
  className = "",
  size = 200,
  alt = "Ad image",
  keywords,
}: {
  src?: string;
  className?: string;
  size?: number;
  alt?: string;
  keywords?: {
    keyword: string;
    intent_reflected?: string;
    likelihood_score?: number;
  }[];
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wasBlocked, setWasBlocked] = useState(false);

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
      return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
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
  }, [src]);

  // Function to detect errors
  const handleImageError = () => {
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
        className={`flex items-center justify-center bg-gray-100 text-gray-400 text-xs text-center p-1 rounded ${className}`}
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
      className="relative border rounded-md overflow-hidden bg-gray-100"
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
        onLoadingComplete={() => setIsLoading(false)}
        unoptimized
      />

      {/* Keywords overlay at the bottom */}
      {keywords && keywords.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 overflow-hidden">
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 3).map((keyword, index) => (
              <span
                key={index}
                className="text-xs text-white bg-gray-700/60 px-1.5 py-0.5 rounded-sm truncate"
                title={keyword.keyword}
              >
                {keyword.keyword.length > 20
                  ? keyword.keyword.substring(0, 18) + "..."
                  : keyword.keyword}
              </span>
            ))}
            {keywords.length > 3 && (
              <span className="text-xs text-white bg-gray-700/60 px-1.5 py-0.5 rounded-sm">
                +{keywords.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdVariants() {
  const [adVariants, setAdVariants] = useState<AdVariantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Fetch total count of items
  const fetchTotalCount = async () => {
    try {
      // Get the data and count the number of records
      const { data, error } = await supabase
        .rpc("join_market_research_and_library_items")
        .select("mr_id");

      if (error) {
        console.error("Error fetching total count:", error);
        return;
      }

      if (data) {
        setTotalItems(data.length);
      }
    } catch (err) {
      console.error("Error in fetchTotalCount:", err);
    }
  };

  // Fetch ad variants from Supabase
  const fetchAdVariants = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call the RPC function to get joined data
      const { data, error } = await supabase
        .rpc("join_market_research_and_library_items")
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)
        .order("mr_created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setAdVariants(data as AdVariantItem[]);

      // If we don't have a total count yet, fetch it
      if (totalItems === 0) {
        await fetchTotalCount();
      }
    } catch (err) {
      console.error("Error fetching ad variants:", err);
      setError("Failed to load ad variants. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when component mounts or pagination changes
  useEffect(() => {
    fetchAdVariants();
  }, [currentPage]);

  // Initialize with total count on first load
  useEffect(() => {
    fetchTotalCount();
  }, []);

  // Generate an array of page numbers for pagination
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5; // Show at most 5 page numbers

    const startPage = Math.max(
      1,
      currentPage - Math.floor(maxVisiblePages / 2)
    );
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
      const adjustedStartPage = Math.max(1, endPage - maxVisiblePages + 1);
      for (let i = adjustedStartPage; i <= endPage; i++) {
        pages.push(i);
      }
    } else {
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Ad Variants</h1>
        <p className="text-muted-foreground">
          Create and manage different variants of your advertisements.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad Variants Collection</CardTitle>
          <CardDescription>
            Showing ad images with associated keywords from market research.
            {totalItems > 0 && (
              <span className="ml-1">
                (Total: {totalItems} items, Page {currentPage} of {totalPages})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-pulse">Loading ad variants...</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-500">
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAdVariants}
                className="ml-4"
              >
                Retry
              </Button>
            </div>
          ) : adVariants.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No ad variants found.
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 justify-start">
              {adVariants.map((item, index) => (
                <div
                  key={`${item.mr_id}-${index}`}
                  className="flex flex-col w-[200px] mb-4"
                >
                  <AdImage
                    src={item.mr_image_url}
                    alt={item.li_name || "Ad variant"}
                    size={200}
                    className="w-full"
                    keywords={item.mr_keywords}
                  />
                  <div
                    className="mt-2 text-sm font-medium truncate"
                    title={item.li_name}
                  >
                    {item.li_name}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Enhanced pagination with page numbers */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="mt-6 flex flex-wrap justify-center items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  currentPage > 1 && setCurrentPage(currentPage - 1)
                }
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              {/* Page numbers */}
              <div className="flex gap-1">
                {generatePageNumbers().map((pageNum) => (
                  <Button
                    key={`page-${pageNum}`}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="min-w-[40px]"
                  >
                    {pageNum}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  currentPage < totalPages && setCurrentPage(currentPage + 1)
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
