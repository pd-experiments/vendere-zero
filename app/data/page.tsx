"use client";

import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useCallback, useEffect, useState } from "react";
import { AdVisualWithMetric } from "../api/metrics/schemas";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import Image from "next/image";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Input } from "@/components/ui/input";
import { blobToBase64 } from "@/lib/utils";
import { AdStructuredOutputSchema } from "../api/evaluate/schemas";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
// import { useDebounce } from "use-debounce";

type SelectedAdType =
  | AdVisualWithMetric
  | (z.infer<typeof AdStructuredOutputSchema> & { image_url: string });

export default function Home() {
  const [data, setData] = useState<AdVisualWithMetric[]>([]);
  const [filteredData, setFilteredData] = useState<AdVisualWithMetric[]>([]);
  const [offset, setOffset] = useState(0);
  const count = 10;
  const [selectedAd, setSelectedAd] = useState<SelectedAdType | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageEvaluation, setUploadedImageEvaluation] =
    useState<z.infer<typeof AdStructuredOutputSchema> | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(false); // New state for search mode

  const fetchData = useCallback(
    async (offset: number) => {
      if (!searchMode) { // Prevent fetchData if searchMode is active
        const res = await fetch(`/api/metrics?offset=${offset}&count=${count}`);
        const fetchedData = await res.json();
        setData(fetchedData);
        setFilteredData(fetchedData);
        if (!selectedAd && fetchedData.length > 0) {
          setSelectedAd(fetchedData[0]);
        }
      }
    },
    [count, selectedAd, searchMode]
  );

  useEffect(() => {
    fetchData(offset);
  }, [offset, fetchData]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    if (query) {
      setSearchMode(true); // Enable search mode
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });
      const searchResults = await res.json();
      setFilteredData(searchResults);
    } else {
      setFilteredData(data);
    }
    setIsSearching(false);
  };

  useEffect(() => {
    if (searchQuery.trim() !== "") {
      handleSearch(searchQuery);
    } else {
      setFilteredData(data);
      setSearchMode(false);
    }
  }, [searchQuery, data]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const base64Image = await blobToBase64(file);
      setUploadedImage(base64Image);
      setIsEvaluating(true);
      setUploadedImageEvaluation(null);
      setIsSearching(true);

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData: base64Image }),
      });

      if (response.ok) {
        const evaluationResult = await response.json();
        setUploadedImageEvaluation(evaluationResult.ad_description);
        setSelectedAd({
          ...evaluationResult.ad_description,
          image_url: base64Image,
        });

        await handleSearch(evaluationResult.ad_description.image_description);
      } else {
        console.error("Failed to evaluate image");
      }
      setIsEvaluating(false);
      setIsSearching(false);
    }
  };

  const handleRowClick = (row: SelectedAdType) => {
    setSelectedAd(row);
  };

  const clearSearch = () => {
    setSearchMode(false);
    setFilteredData(data);
    setSearchQuery("");
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4">
        <h1 className="text-2xl font-bold">
          AI-Generated Visual Analytics on Nike Ads
        </h1>
        <p className="mb-4">
          The following are visual features and sample analytics taken from Nike
          ads. The visual features have been extracted using our AI model.
        </p>
        {searchMode && (
          <Button onClick={clearSearch} variant="outline" className="mb-4">
            Clear Search
          </Button>
        )}
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-grow pb-2">
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="p-4 h-full flex flex-col">
            <div className="flex justify-between items-center pb-4 gap-2">
              <div className="flex-grow flex items-center gap-2">
                <Input
                  type="search"
                  placeholder="Search..."
                  className="max-w-md"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button
                  onClick={() => document.getElementById("fileInput")?.click()}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Search with Image
                </Button>
                <input
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setOffset(offset - count)}
                  disabled={offset === 0}
                  variant="outline"
                  size="icon"
                >
                  <ChevronLeft />
                </Button>
                <div className="text-sm font-bold bg-gray-100 px-3 py-2 rounded-md">
                  {offset / count + 1}
                </div>
                <Button
                  onClick={() => setOffset(offset + count)}
                  disabled={data.length < count}
                  variant="outline"
                  size="icon"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>

            {uploadedImage && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">
                  Uploaded Image Evaluation
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/6">Image</TableHead>
                      <TableHead className="w-1/4">Keywords</TableHead>
                      <TableHead className="w-1/3">Description</TableHead>
                      <TableHead className="w-1/4">Sentiment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => {
                        if (uploadedImageEvaluation) {
                          setSelectedAd({
                            ...uploadedImageEvaluation,
                            image_url: uploadedImage,
                          });
                        }
                      }}
                    >
                      <TableCell className="w-1/6">
                        <Image
                          src={uploadedImage}
                          alt="Uploaded image"
                          width={100}
                          height={100}
                          className="object-cover"
                        />
                      </TableCell>
                      <TableCell className="w-1/4">
                        {isEvaluating ? (
                          <Skeleton className="h-20 w-full" />
                        ) : (
                          <div className="max-h-20 overflow-y-auto">
                            {uploadedImageEvaluation?.features?.map((f) => (
                              <div key={f.keyword} className="truncate">
                                {f.keyword} ({f.category},{" "}
                                {f.confidence_score.toFixed(2)})
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-1/3">
                        {isEvaluating ? (
                          <Skeleton className="h-20 w-full" />
                        ) : (
                          <div className="max-h-20 overflow-y-auto">
                            {uploadedImageEvaluation?.image_description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-1/4">
                        {isEvaluating ? (
                          <Skeleton className="h-20 w-full" />
                        ) : (
                          uploadedImageEvaluation && (
                            <div className="truncate">
                              {uploadedImageEvaluation.sentiment_analysis.tone}(
                              {uploadedImageEvaluation.sentiment_analysis.confidence.toFixed(
                                2
                              )}
                              )
                            </div>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div
              className="overflow-auto flex-grow"
              style={{ maxHeight: "calc(100% - 3rem)" }}
            >
              {uploadedImage && (
                <h3 className="text-lg font-semibold mb-2">Results</h3>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4">Image</TableHead>
                    <TableHead className="w-1/4">Keywords</TableHead>
                    <TableHead className="w-1/4">Impressions</TableHead>
                    <TableHead className="w-1/4">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSearching
                    ? // Skeleton rows
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell className="w-1/4">
                            <Skeleton className="h-[100px] w-[100px]" />
                          </TableCell>
                          <TableCell className="w-1/4">
                            <Skeleton className="h-[100px] w-full" />
                          </TableCell>
                          <TableCell className="w-1/4">
                            <Skeleton className="h-[20px] w-1/2" />
                          </TableCell>
                          <TableCell className="w-1/4">
                            <Skeleton className="h-[20px] w-1/2" />
                          </TableCell>
                        </TableRow>
                      ))
                    : filteredData.map((row) => (
                        <TableRow
                          key={row.id}
                          onClick={() => handleRowClick(row)}
                          className="cursor-pointer"
                        >
                          <TableCell className="w-1/4">
                            <Image
                              src={row.image_url}
                              alt={row.image_description}
                              width={100}
                              height={100}
                            />
                          </TableCell>
                          <TableCell className="w-1/4">
                            <div className="max-h-[100px] overflow-y-auto">
                              {row.features.map((f) => (
                                <div key={f.keyword}>
                                  {f.keyword} ({f.category}, {f.location})
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="w-1/4">
                            {row.ad_metrics && row.ad_metrics.length > 0 ? row.ad_metrics[0].impressions : "N/A"}
                          </TableCell>
                          <TableCell className="w-1/4">
                            {row.ad_metrics && row.ad_metrics.length > 0 ? row.ad_metrics[0].ctr : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={30}>
          {selectedAd ? (
            <div className="p-4 flex flex-col gap-4 h-full overflow-auto">
              <div className="relative h-96">
                <Image
                  src={selectedAd.image_url}
                  alt={selectedAd.image_description}
                  objectFit="contain"
                  layout="fill"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-sm">{selectedAd.image_description}</div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Visual Attributes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAd.features.map((f) => (
                      <TableRow key={f.keyword}>
                        <TableCell>{f.keyword}</TableCell>
                        <TableCell>{f.category}</TableCell>
                        <TableCell>
                          {f.confidence_score?.toFixed(2) || "N/A"}
                        </TableCell>
                        <TableCell>
                          {f.visual_attributes?.map((a) => (
                            <div key={a.attribute}>
                              {a.attribute}: {a.value}
                            </div>
                          )) || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {"sentiment_analysis" in selectedAd && (
                <div className="border rounded-md p-4">
                  <h4 className="font-semibold mb-2">Sentiment Analysis</h4>
                  <p>Tone: {selectedAd.sentiment_analysis.tone}</p>
                  <p>
                    Confidence:{" "}
                    {selectedAd.sentiment_analysis.confidence.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              No ad selected
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
