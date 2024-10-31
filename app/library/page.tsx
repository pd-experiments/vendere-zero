"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react"; //MoreVertical removed
import { Progress } from "@/components/ui/progress";
// import { AdStructuredOutputSchema } from "../api/datagen/models";
// import { z } from "zod";
// import {
//     DropdownMenu,
//     DropdownMenuContent,
//     DropdownMenuItem,
//     DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from '@/lib/types/schema';

type UploadingFile = {
    id: string;
    fileName: string;
    file: File;
    status: "uploading" | "processing" | "complete" | "error";
    error?: string;
};

type AdRecord = {
    id: string;
    image_url: string;
    image_description: string;
    features: {
        keyword: string;
        confidence_score: number;
        category: string;
        location: string;
        visual_attributes?: { attribute: string; value: string; }[];
    }[];
    sentiment_analysis: {
        tone: string;
        confidence: number;
    };
    created_at: string;
};

// Add type definitions for the database responses
type AdOutput = Database['public']['Tables']['ad_structured_output']['Row'];
type Feature = Database['public']['Tables']['features']['Row'] & {
    visual_attributes: Database['public']['Tables']['visual_attributes']['Row'][];
};
type SentimentAnalysis = Database['public']['Tables']['sentiment_analysis']['Row'];

export default function Library() {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [records, setRecords] = useState<AdRecord[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<AdRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const RECORDS_PER_PAGE = 10;

    // Fetch user's records on mount
    useEffect(() => {
        fetchRecords(1);
    }, []);

    const fetchRecords = async (page = 1) => {
        setLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error("Error getting user:", userError);
            setLoading(false);
            return;
        }

        // Calculate range for pagination
        const from = (page - 1) * RECORDS_PER_PAGE;
        const to = from + RECORDS_PER_PAGE - 1;

        // Get base records with pagination
        const { data: adOutputs, error: adError, count } = await supabase
            .from("ad_structured_output")
            .select(`
                id,
                image_url,
                image_description
            `, { count: 'exact' })
            .eq('user', user.id)
            .range(from, to)
            .returns<AdOutput[]>();

        if (adError || !adOutputs) {
            console.error("Error fetching ad outputs:", adError);
            setLoading(false);
            return;
        }

        // Update hasMore based on count
        setHasMore(count ? from + RECORDS_PER_PAGE < count : false);

        // Get features
        const { data: features, error: featuresError } = await supabase
            .from("features")
            .select(`
                id,
                ad_output_id,
                keyword,
                confidence_score,
                category,
                location,
                visual_attributes (
                    id,
                    attribute,
                    value
                )
            `)
            .eq('user', user.id)
            .returns<Feature[]>();

        if (featuresError || !features) {
            console.error("Error fetching features:", featuresError);
            setLoading(false);
            return;
        }

        // Get sentiment analysis
        const { data: sentiments, error: sentimentError } = await supabase
            .from("sentiment_analysis")
            .select(`
                id,
                ad_output_id,
                tone,
                confidence
            `)
            .eq('user', user.id)
            .returns<SentimentAnalysis[]>();

        if (sentimentError || !sentiments) {
            console.error("Error fetching sentiments:", sentimentError);
            setLoading(false);
            return;
        }

        // Combine the data
        const transformedRecords: AdRecord[] = adOutputs.map(adOutput => {
            // Get features for this ad
            const adFeatures = features.filter(f => f.ad_output_id === adOutput.id);
            // Get sentiment for this ad
            const adSentiment = sentiments.find(s => s.ad_output_id === adOutput.id);

            return {
                id: adOutput.id,
                image_url: adOutput.image_url,
                image_description: adOutput.image_description,
                created_at: new Date().toISOString(), // Use current date since we don't have created_at
                features: adFeatures.map(feature => ({
                    keyword: feature.keyword,
                    confidence_score: feature.confidence_score,
                    category: feature.category,
                    location: feature.location,
                    visual_attributes: feature.visual_attributes
                })),
                sentiment_analysis: adSentiment ? {
                    tone: adSentiment.tone,
                    confidence: adSentiment.confidence
                } : {
                    tone: '',
                    confidence: 0
                }
            };
        });

        if (page === 1) {
            setRecords(transformedRecords);
        } else {
            setRecords(prev => [...prev, ...transformedRecords]);
        }

        setLoading(false);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files?.length) return;

        const newFiles = Array.from(files).map(file => ({
            id: Math.random().toString(36).slice(2),
            fileName: file.name,
            file,
            status: "uploading" as const
        }));

        setUploadingFiles(prev => [...prev, ...newFiles]);

        // Create FormData with all files
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });

        try {
            const response = await fetch("/api/datagen", {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error("Upload failed");

            const { results } = await response.json();

            // Update status for each file
            setUploadingFiles(prev =>
                prev.map(file => {
                    const result = results.find((r: { filename: string; status: string; error?: string }) =>
                        r.filename === file.fileName
                    );
                    return {
                        ...file,
                        status: result?.status === "success" ? "complete" : "error",
                        error: result?.error
                    };
                })
            );

            // Refresh records
            await fetchRecords();

            // Clear completed uploads after a delay
            setTimeout(() => {
                setUploadingFiles(prev => prev.filter(f => f.status !== "complete"));
            }, 3000);

        } catch (error) {
            setUploadingFiles(prev =>
                prev.map(file => ({
                    ...file,
                    status: "error",
                    error: error instanceof Error ? error.message : "Upload failed"
                }))
            );
        }
    };

    // Define columns
    const columns: ColumnDef<AdRecord>[] = [
        {
            accessorKey: "image_url",
            header: "Image",
            cell: ({ row }) => (
                <div className="w-16 h-16 relative rounded overflow-hidden">
                    <Image
                        src={row.original.image_url}
                        alt="Ad image"
                        layout="fill"
                        objectFit="cover"
                    />
                </div>
            ),
        },
        {
            accessorKey: "image_description",
            header: "Description",
            cell: ({ row }) => (
                <p className="truncate max-w-[400px] text-sm">
                    {row.original.image_description}
                </p>
            ),
        },
        {
            accessorKey: "features",
            header: "Features",
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.features.slice(0, 3).map(feature => (
                        <span key={feature.keyword} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-accent">
                            {feature.keyword}
                        </span>
                    ))}
                    {row.original.features.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                            +{row.original.features.length - 3} more
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "sentiment_analysis",
            header: "Sentiment",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="text-sm capitalize">
                        {row.original.sentiment_analysis.tone}
                    </span>
                    <Progress
                        value={row.original.sentiment_analysis.confidence * 100}
                        className="h-2 w-20"
                    />
                </div>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Created",
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {new Date(row.original.created_at).toLocaleString()}
                </span>
            ),
        }
    ];

    // Add a load more function
    const loadMore = () => {
        if (!loading && hasMore) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            fetchRecords(nextPage);
        }
    };

    // Add the loading skeleton component
    const LoadingSkeleton = () => (
        <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4">
                    <Skeleton className="h-16 w-16 rounded" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-[250px]" />
                        <div className="flex space-x-2">
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                    </div>
                    <Skeleton className="h-4 w-[100px]" />
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b">
                <div className="px-6 py-4 max-w-[1400px] mx-auto w-full">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
                            <p className="text-sm text-muted-foreground">
                                Upload and analyze your ad images
                            </p>
                        </div>
                        <Button
                            onClick={() => document.getElementById('fileInput')?.click()}
                            className="flex items-center gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Upload Images
                        </Button>
                        <input
                            id="fileInput"
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>
            </div>

            {/* Upload Progress */}
            {uploadingFiles.length > 0 && (
                <div className="px-6 py-4 max-w-[1400px] mx-auto w-full">
                    <div className="space-y-2">
                        {uploadingFiles.map(file => (
                            <div key={file.id} className="flex items-center gap-4">
                                <span className="text-sm">{file.fileName}</span>
                                {file.status === "uploading" && (
                                    <Progress value={undefined} className="w-[200px]" />
                                )}
                                {file.status === "complete" && (
                                    <span className="text-sm text-green-600">Complete</span>
                                )}
                                {file.status === "error" && (
                                    <span className="text-sm text-red-600">{file.error}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="px-6 py-6 max-w-[1400px] mx-auto w-full">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={70}>
                        {loading && records.length === 0 ? (
                            <LoadingSkeleton />
                        ) : (
                            <>
                                <DataTable
                                    columns={columns}
                                    data={records}
                                    onRowClick={(record) => setSelectedRecord(record)}
                                />
                                {hasMore && (
                                    <div className="py-4 text-center">
                                        <Button
                                            variant="outline"
                                            onClick={loadMore}
                                            disabled={loading}
                                        >
                                            {loading ? "Loading..." : "Load More"}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </ResizablePanel>

                    {selectedRecord && (
                        <>
                            <ResizableHandle />
                            <ResizablePanel defaultSize={30}>
                                <div className="h-[calc(100vh-8rem)] relative bg-background pl-3">
                                    <div className="bg-card rounded-xl shadow-sm border h-full flex flex-col p-0.5">
                                        {/* Sticky Header */}
                                        <div className="shrink-0 px-8 py-6 border-b flex flex-col gap-4 bg-background">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-xl font-semibold">Image Details</h2>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setSelectedRecord(null)}
                                                    className="h-8 w-8"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 text-sm">
                                                {/* Image preview */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-8 h-8 relative shrink-0 rounded-md overflow-hidden bg-accent">
                                                        <Image
                                                            src={selectedRecord.image_url}
                                                            alt="Selected image"
                                                            layout="fill"
                                                            objectFit="cover"
                                                        />
                                                    </div>
                                                    <span className="font-medium truncate">
                                                        {selectedRecord.id}
                                                    </span>
                                                </div>

                                                {/* Metadata */}
                                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                                    <div className="text-muted-foreground shrink-0">
                                                        {new Date(selectedRecord.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Scrollable Content */}
                                        <div className="flex-1 overflow-y-auto">
                                            <div className="p-8 space-y-8">
                                                {/* Large Image Preview */}
                                                <div className="relative h-[300px] w-full rounded-lg overflow-hidden bg-accent/50">
                                                    <Image
                                                        src={selectedRecord.image_url}
                                                        alt="Selected image"
                                                        layout="fill"
                                                        objectFit="contain"
                                                        className="bg-accent/50"
                                                    />
                                                </div>

                                                {/* Features Table */}
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2">Visual Features</h3>
                                                    <div className="rounded-lg border overflow-x-auto">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="w-[25%]">Keyword</TableHead>
                                                                    <TableHead className="w-[25%]">Category</TableHead>
                                                                    <TableHead className="w-[15%]">Confidence</TableHead>
                                                                    <TableHead className="w-[35%]">Location</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {selectedRecord.features.map((feature) => (
                                                                    <TableRow key={feature.keyword}>
                                                                        <TableCell className="font-medium">
                                                                            {feature.keyword}
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground">
                                                                            {feature.category}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <span className="text-sm">
                                                                                {(feature.confidence_score * 100).toFixed(0)}%
                                                                            </span>
                                                                        </TableCell>
                                                                        <TableCell className="text-muted-foreground">
                                                                            {feature.location}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>

                                                {/* Analysis section */}
                                                <div>
                                                    <h3 className="text-sm font-medium mb-2">Analysis</h3>
                                                    <div className="space-y-4 bg-accent/50 rounded-lg p-4">
                                                        <div>
                                                            <h4 className="text-sm text-muted-foreground mb-1">Description</h4>
                                                            <p className="text-sm">
                                                                {selectedRecord.image_description}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm text-muted-foreground mb-1">Sentiment</h4>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm capitalize">
                                                                    {selectedRecord.sentiment_analysis.tone}
                                                                </span>
                                                                <Progress
                                                                    value={selectedRecord.sentiment_analysis.confidence * 100}
                                                                    className="h-2 w-20"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ResizablePanel>
                        </>
                    )}
                </ResizablePanelGroup>
            </div>
        </div>
    );
} 