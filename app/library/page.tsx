"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { UploadCloud, Video, MoreHorizontal, Trash2, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from '@/lib/types/schema';
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UploadingFile = {
    id: string;
    fileName: string;
    file: File;
    fileType: "image" | "video";
    status: "uploading" | "processing" | "complete" | "error";
    error?: string;
    progress?: number;
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
    const router = useRouter();
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [records, setRecords] = useState<AdRecord[]>([]);
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
            fileType: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
            status: "uploading" as const,
            progress: 0
        }));

        setUploadingFiles(prev => [...prev, ...newFiles]);

        // Process each file
        for (const uploadingFile of newFiles) {
            const formData = new FormData();

            if (uploadingFile.fileType === 'video') {
                // Handle video upload
                formData.append('video', uploadingFile.file);

                try {
                    const response = await fetch("/api/upload-video", {
                        method: "POST",
                        body: formData
                    });

                    if (!response.ok) throw new Error("Upload failed");

                    setUploadingFiles(prev =>
                        prev.map(file =>
                            file.id === uploadingFile.id
                                ? { ...file, status: "complete" }
                                : file
                        )
                    );

                    // Refresh records after successful upload
                    await fetchRecords();

                } catch (error) {
                    setUploadingFiles(prev =>
                        prev.map(file =>
                            file.id === uploadingFile.id
                                ? {
                                    ...file,
                                    status: "error",
                                    error: error instanceof Error ? error.message : "Upload failed"
                                }
                                : file
                        )
                    );
                }
            } else {
                // Handle image upload (existing logic)
                formData.append('files', uploadingFile.file);

                try {
                    const response = await fetch("/api/datagen", {
                        method: "POST",
                        body: formData
                    });

                    if (!response.ok) throw new Error("Upload failed");

                    const { results } = await response.json();

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

                    await fetchRecords();

                } catch (error) {
                    setUploadingFiles(prev =>
                        prev.map(file => ({
                            ...file,
                            status: "error",
                            error: error instanceof Error ? error.message : "Upload failed"
                        }))
                    );
                }
            }
        }

        // Clear completed uploads after a delay
        setTimeout(() => {
            setUploadingFiles(prev => prev.filter(f => f.status !== "complete"));
        }, 3000);
    };

    // Define columns
    const columns: ColumnDef<AdRecord>[] = [
        {
            accessorKey: "image_url",
            header: "Image",
            cell: ({ row }) => (
                <div className="w-14 h-14 relative bg-accent/50">
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
                <div className="space-y-1.5">
                    {row.original.features.slice(0, 3).map(feature => (
                        <div
                            key={feature.keyword}
                            className="flex items-center justify-between"
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">{feature.keyword}</span>
                                <span className="text-xs text-muted-foreground">
                                    ({feature.category})
                                </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {(feature.confidence_score * 100).toFixed(0)}%
                            </span>
                        </div>
                    ))}
                    {row.original.features.length > 3 && (
                        <span className="text-xs text-muted-foreground block mt-1">
                            +{row.original.features.length - 3} more features
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "sentiment_tone",
            header: "Tone",
            cell: ({ row }) => (
                <span className="text-sm capitalize">
                    {row.original.sentiment_analysis.tone}
                </span>
            ),
        },
        {
            accessorKey: "sentiment_confidence",
            header: "Confidence",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Progress
                        value={row.original.sentiment_analysis.confidence * 100}
                        className="h-2 w-16"
                    />
                    <span className="text-xs text-muted-foreground">
                        {(row.original.sentiment_analysis.confidence * 100).toFixed(0)}%
                    </span>
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
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const handleDelete = async (e: React.MouseEvent) => {
                    e.stopPropagation(); // Prevent row click when clicking delete
                    if (confirm("Are you sure you want to delete this item?")) {
                        const { error } = await supabase
                            .from("ad_structured_output")
                            .delete()
                            .eq('id', row.original.id);

                        if (error) {
                            console.error("Error deleting record:", error);
                            return;
                        }

                        // Refresh the records
                        fetchRecords(currentPage);
                    }
                };

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                className="h-8 w-8 p-0"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={handleDelete}
                                className="text-destructive focus:text-destructive"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
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
        <div className="min-h-screen bg-background">
            {/* Header Loading */}
            <div className="border-b">
                <div className="px-6 py-4 max-w-[1400px] mx-auto">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <Skeleton className="h-8 w-32" /> {/* Title */}
                            <Skeleton className="h-4 w-64" /> {/* Subtitle */}
                        </div>
                        <Skeleton className="h-8 w-24" /> {/* Upload button */}
                    </div>
                </div>
            </div>

            {/* Table Loading */}
            <div className="px-6 py-4 max-w-[1400px] mx-auto">
                <div className="border bg-card">
                    {/* Table Controls */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <Skeleton className="h-8 w-[380px]" /> {/* Search bar */}
                        <Skeleton className="h-8 w-24" /> {/* Columns button */}
                    </div>

                    {/* Table Header */}
                    <div className="flex items-center px-4 py-3 border-b">
                        <Skeleton className="h-4 w-14 mr-4" /> {/* Image header */}
                        <Skeleton className="h-4 w-[400px] mr-4" /> {/* Description header */}
                        <Skeleton className="h-4 w-[200px] mr-4" /> {/* Features header */}
                        <Skeleton className="h-4 w-20 mr-4" /> {/* Tone header */}
                        <Skeleton className="h-4 w-24 mr-4" /> {/* Confidence header */}
                        <Skeleton className="h-4 w-32 mr-4" /> {/* Created header */}
                        <Skeleton className="h-4 w-8" /> {/* Actions header */}
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y">
                        {Array(6).fill(0).map((_, i) => (
                            <div key={i} className="flex items-center px-4 py-3">
                                <Skeleton className="h-14 w-14 mr-4" /> {/* Image */}
                                <Skeleton className="h-8 w-[400px] mr-4" /> {/* Description */}
                                <div className="w-[200px] mr-4 space-y-1">
                                    <Skeleton className="h-5 w-full" />
                                    <Skeleton className="h-5 w-4/5" />
                                    <Skeleton className="h-5 w-3/5" />
                                </div>
                                <Skeleton className="h-6 w-20 mr-4" /> {/* Tone */}
                                <div className="flex items-center gap-2 mr-4">
                                    <Skeleton className="h-2 w-16" /> {/* Progress bar */}
                                    <Skeleton className="h-4 w-8" /> {/* Percentage */}
                                </div>
                                <Skeleton className="h-6 w-32 mr-4" /> {/* Created date */}
                                <Skeleton className="h-8 w-8" /> {/* Actions */}
                            </div>
                        ))}
                    </div>

                    {/* Table Footer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <Skeleton className="h-4 w-20" /> {/* Items count */}
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-20" /> {/* Previous button */}
                            <Skeleton className="h-8 w-20" /> {/* Next button */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            {loading && records.length === 0 ? (
                <LoadingSkeleton />
            ) : (
                <>
                    {/* Header */}
                    <div className="border-b">
                        <div className="px-6 py-4 max-w-[1400px] mx-auto">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-2xl font-semibold">Library</h1>
                                    <p className="text-sm text-muted-foreground">
                                        AI-powered visual analysis of your creative content
                                    </p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button className="h-8 flex items-center gap-2" variant="secondary">
                                            <UploadCloud className="h-4 w-4" />
                                            Upload
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[160px]">
                                        <DropdownMenuItem
                                            onClick={() => document.getElementById('imageInput')?.click()}
                                            className="flex items-center gap-2"
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                            <span>Upload Images</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => document.getElementById('videoInput')?.click()}
                                            className="flex items-center gap-2"
                                        >
                                            <Video className="h-4 w-4" />
                                            <span>Upload Video</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <input
                                    id="imageInput"
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <input
                                    id="videoInput"
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Upload Progress */}
                    {uploadingFiles.length > 0 && (
                        <div className="border-b bg-muted/50">
                            <div className="px-6 py-2 max-w-[1400px] mx-auto">
                                <div className="space-y-2">
                                    {uploadingFiles.map(file => (
                                        <div key={file.id} className="flex items-center gap-4">
                                            <span className="text-sm font-medium">{file.fileName}</span>
                                            {file.status === "uploading" && (
                                                <Progress value={undefined} className="w-[200px] h-2" />
                                            )}
                                            {file.status === "complete" && (
                                                <span className="text-sm text-green-600 font-medium">Complete</span>
                                            )}
                                            {file.status === "error" && (
                                                <span className="text-sm text-red-600">{file.error}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Content */}
                    <div className="px-6 py-4 max-w-[1400px] mx-auto">
                        <div className="space-y-2">
                            <div className="border-0 bg-card">
                                <DataTable
                                    columns={columns}
                                    data={records}
                                    onRowClick={(record) => router.push(`/library/${record.id}`)}
                                    searchPlaceholder="Search your creative library..."
                                    maxRowsPerPage={6}
                                />
                            </div>
                            {hasMore && (
                                <div className="flex justify-center pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={loadMore}
                                        disabled={loading}
                                        className="h-8"
                                    >
                                        {loading ? "Loading..." : "Load More"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
} 