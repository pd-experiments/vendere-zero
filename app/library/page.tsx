"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { UploadCloud, Video, MoreHorizontal, Trash2, Image as ImageIcon, Loader2, X, Search } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
// import { useQuery } from '@tanstack/react-query';

type LibraryItem = {
    id: string;
    type: 'image' | 'video';
    image_url?: string;
    name?: string | null;
    video?: {
        id: string;
        name: string;
        description: string | null;
        video_url: string;
        frames: Array<{
            mapping_id: string;
            frame_id: string;
            image_url: string;
            image_description: string;
            frame_number: number;
            video_timestamp: unknown;
        }>;
    };
    image_description: string;
    features: Array<{
        keyword: string;
        confidence_score: number;
        category: string;
        location: string;
        visual_attributes?: Array<{
            attribute: string;
            value: string;
        }>;
    }>;
    sentiment_analysis: {
        tones: string[];
        confidence: number;
    };
    created_at: string;
};

type UploadingFile = {
    id: string;
    fileName: string;
    file: File;
    fileType: "image" | "video";
    status: "uploading" | "processing" | "complete" | "error";
    error?: string;
    progress?: number;
    abortController?: AbortController;
};

type SearchResult = LibraryItem & {
    similarity: number;
};

type SearchResponse = {
    results: SearchResult[];
    analysis: string;
    query: string;
};

export default function Library() {
    const router = useRouter();
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 100]);
    const [selectedTones, setSelectedTones] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [records, setRecords] = useState<LibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLibraryData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/library');
                if (!response.ok) throw new Error("Failed to fetch library data");
                const data = await response.json();
                setRecords(data);
            } catch (error) {
                console.error("Error fetching library data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLibraryData();
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files?.length) return;

        const newFiles = Array.from(files).map(file => ({
            id: Math.random().toString(36).slice(2),
            fileName: file.name,
            file,
            fileType: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
            status: "uploading" as const,
            progress: 0,
            abortController: new AbortController()
        }));

        setUploadingFiles(prev => [...prev, ...newFiles]);

        // Process each file
        for (const uploadingFile of newFiles) {
            const formData = new FormData();

            if (uploadingFile.fileType === 'video') {
                formData.append('video', uploadingFile.file);

                try {
                    const response = await fetch("/api/upload-video", {
                        method: "POST",
                        body: formData,
                        signal: uploadingFile.abortController?.signal
                    });

                    if (!response.ok) throw new Error("Upload failed");
                    const result = await response.json();

                    // Check if upload was cancelled
                    if (uploadingFile.abortController?.signal.aborted) {
                        // Delete the video and associated data
                        await deleteVideoData(result.videoId);
                        return;
                    }

                    setUploadingFiles(prev =>
                        prev.map(file =>
                            file.id === uploadingFile.id
                                ? { ...file, status: "complete" }
                                : file
                        )
                    );

                    // await fetchLibraryData();

                } catch (error: unknown) {
                    if (error instanceof Error && error.name === 'AbortError') {
                        setUploadingFiles(prev => prev.filter(f => f.id !== uploadingFile.id));
                        return;
                    }

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
                // Handle image upload with cancellation
                formData.append('files', uploadingFile.file);

                try {
                    const response = await fetch("/api/datagen", {
                        method: "POST",
                        body: formData,
                        signal: uploadingFile.abortController?.signal
                    });

                    if (!response.ok) throw new Error("Upload failed");
                    const { results } = await response.json();

                    // Check if upload was cancelled
                    if (uploadingFile.abortController?.signal.aborted) {
                        // Delete the uploaded image data
                        const imageId = results[0]?.id;
                        if (imageId) {
                            await deleteImageData(imageId);
                        }
                        return;
                    }

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

                    // await fetchLibraryData();

                } catch (error: unknown) {
                    if (error instanceof Error && error.name === 'AbortError') {
                        setUploadingFiles(prev => prev.filter(f => f.id !== uploadingFile.id));
                        return;
                    }

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

        setTimeout(() => {
            setUploadingFiles(prev => prev.filter(f => f.status !== "complete"));
        }, 3000);
    };

    // Add helper functions to delete data
    const deleteVideoData = async (videoId: string) => {
        const { data: mappings } = await supabase
            .from('video_frames_mapping')
            .select('frame_id')
            .eq('video_id', videoId);

        if (mappings) {
            // Delete all frame records from ad_structured_output
            for (const mapping of mappings) {
                await supabase
                    .from('ad_structured_output')
                    .delete()
                    .eq('id', mapping.frame_id);
            }
        }

        // Delete mappings
        await supabase
            .from('video_frames_mapping')
            .delete()
            .eq('video_id', videoId);

        // Delete video record
        await supabase
            .from('videos')
            .delete()
            .eq('id', videoId);
    };

    const deleteImageData = async (imageId: string) => {
        await supabase
            .from('ad_structured_output')
            .delete()
            .eq('id', imageId);
    };

    // Add cancel upload handler
    const handleCancelUpload = (fileId: string) => {
        setUploadingFiles(prev => {
            const file = prev.find(f => f.id === fileId);
            if (file?.abortController) {
                file.abortController.abort();
            }
            return prev.filter(f => f.id !== fileId);
        });
    };

    // Get unique tones with optional chaining
    const allTones = useMemo(() => {
        const tones = new Set<string>();
        (records || []).forEach((item) => {
            item.sentiment_analysis.tones.forEach((tone) => tones.add(tone));
        });
        return Array.from(tones);
    }, [records]);

    // Define columns
    const columns: ColumnDef<LibraryItem>[] = [
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => (
                <div className="flex items-center">
                    {row.original.type === 'video' ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Video className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Video</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <ImageIcon className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Image</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }) => (
                <div className="py-1">
                    <span className="text-xs font-medium truncate block max-w-[200px]">
                        {row.original.name ?? 'Untitled'}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "preview",
            header: "Preview",
            cell: ({ row }) => (
                <div className="py-1">
                    {row.original.type === 'video' ? (
                        <div className="flex -space-x-2">
                            {row.original.video?.frames.slice(0, 2).map((frame, index) => (
                                <div
                                    key={frame.frame_id}
                                    className="relative w-10 h-10 border-2 border-background rounded-md overflow-hidden hover:scale-105 transition-transform"
                                    style={{ zIndex: 2 - index }}
                                >
                                    <Image
                                        src={frame.image_url}
                                        alt={`Frame ${frame.frame_number}`}
                                        layout="fill"
                                        objectFit="cover"
                                    />
                                </div>
                            ))}
                            {(row.original.video?.frames.length || 0) > 2 && (
                                <div
                                    className="relative w-10 h-10 border-2 border-background rounded-md bg-muted/50 flex items-center justify-center"
                                    style={{ zIndex: 0 }}
                                >
                                    <span className="text-xs font-medium text-muted-foreground">
                                        +{(row.original.video?.frames.length || 0) - 2}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-10 h-10 relative border-2 border-background rounded-md overflow-hidden hover:scale-105 transition-transform">
                            <Image
                                src={row.original.image_url!}
                                alt="Image"
                                layout="fill"
                                objectFit="cover"
                            />
                        </div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: "image_description",
            header: "Description",
            cell: ({ row }) => (
                <div className="py-1">
                    <p className="max-w-[280px] line-clamp-2 text-sm text-muted-foreground">
                        {row.original.image_description}
                    </p>
                </div>
            ),
        },
        {
            accessorKey: "features",
            header: "Features",
            cell: ({ row }) => (
                <div className="py-1 space-y-1">
                    {row.original.features.slice(0, 2).map(feature => (
                        <div
                            key={feature.keyword}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="font-medium min-w-[80px] truncate">
                                {feature.keyword}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                                {feature.category}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {(feature.confidence_score * 100).toFixed(0)}%
                            </span>
                        </div>
                    ))}
                    {row.original.features.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                            +{row.original.features.length - 2} more
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorFn: (row) => row.sentiment_analysis.tones,
            id: "sentiment_tone",
            header: "Tone",
            filterFn: (row, id, filterValue) => {
                if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
                const tones = row.getValue<string[]>(id);
                return tones.some(tone => filterValue.includes(tone.toLowerCase()));
            },
            cell: ({ row }) => (
                <div className="py-1 space-y-1">
                    {row.original.sentiment_analysis.tones.slice(0, 2).map((tone, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                            <span className="text-sm capitalize text-muted-foreground">
                                {tone}
                            </span>
                        </div>
                    ))}
                    {row.original.sentiment_analysis.tones.length > 2 && (
                        <span className="text-xs text-muted-foreground pl-3">
                            +{row.original.sentiment_analysis.tones.length - 2} more
                        </span>
                    )}
                </div>
            ),
        },
        {
            accessorFn: (row) => row.sentiment_analysis.confidence,
            id: "sentiment_confidence",
            header: "Confidence",
            filterFn: (row, id, filterValue) => {
                if (!filterValue) return true;
                const [min, max] = filterValue as [number, number];
                const confidence = row.getValue<number>(id);
                return confidence >= min && confidence <= max;
            },
            cell: ({ row }) => (
                <div className="flex items-center gap-3 py-1">
                    <Progress
                        value={row.original.sentiment_analysis.confidence * 100}
                        className="h-1.5 w-14"
                    />
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                            {(row.original.sentiment_analysis.confidence * 100).toFixed(0)}%
                        </span>
                        {row.original.type === 'video' && (
                            <span className="text-xs text-muted-foreground/60">(avg)</span>
                        )}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "created_at",
            header: "Created",
            sortingFn: "datetime",
            cell: ({ row }) => (
                <div className="py-1">
                    <span className="text-xs text-muted-foreground">
                        {new Date(row.original.created_at).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const handleDelete = async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to delete this item?")) {
                        const { error } = await supabase
                            .from("ad_structured_output")
                            .delete()
                            .eq('id', row.original.id);

                        if (error) {
                            console.error("Error deleting record:", error);
                            return;
                        }

                        // await fetchLibraryData();
                    }
                };

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-muted"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
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
                        <Skeleton className="h-4 w-14 mr-4" /> {/* Type header */}
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
                                <Skeleton className="h-6 w-14 mr-4" /> {/* Type */}
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

    // Add this function to handle search
    const handleSearch = async (query: string) => {
        setSearchQuery(query);

        if (!query.trim()) {
            setSearchResults(null);
            setShowAnalysis(false);
            return;
        }

        setIsSearching(true);
        setShowAnalysis(true);

        try {
            const response = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });

            if (!response.ok) throw new Error("Search failed");
            const data: SearchResponse = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    // Add this function to clear search
    const clearSearch = () => {
        setSearchQuery("");
        setSearchResults(null);
        setShowAnalysis(false);
    };

    // Modify the search input section to handle key press
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch(searchQuery);
        }
    };

    // Modify the search input to use onChange without immediate search
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (!e.target.value) {
            clearSearch();
        }
    };

    if (isLoading) return <LoadingSkeleton />;

    return (
        <div className="min-h-screen bg-background">
            <>
                <div className="border-b">
                    <div className="px-6 py-4 max-w-[1400px] mx-auto">
                        <div className="flex flex-col gap-4">
                            {/* Header content is always shown */}
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-2xl font-semibold">Library</h1>
                                    <p className="text-sm text-muted-foreground">
                                        AI-powered visual analysis of your creative content
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {uploadingFiles.length > 0 && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex items-center gap-2"
                                                >
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    <span>Uploading {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}</span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                align="end"
                                                className="w-80 p-2"
                                            >
                                                <div className="space-y-2">
                                                    {uploadingFiles.map(file => (
                                                        <div
                                                            key={file.id}
                                                            className="flex items-start gap-2 p-2 rounded-lg bg-muted/30"
                                                        >
                                                            <div className="relative w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                                                                {file.fileType === 'image' && file.file && (
                                                                    <Image
                                                                        src={URL.createObjectURL(file.file)}
                                                                        alt={file.fileName}
                                                                        layout="fill"
                                                                        objectFit="cover"
                                                                    />
                                                                )}
                                                                {file.fileType === 'video' && (
                                                                    <Video className="h-4 w-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
                                                                )}
                                                                {file.status === "uploading" && (
                                                                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                                                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                                    </div>
                                                                )}
                                                                {file.status === "complete" && (
                                                                    <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                                                                        <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                                                            <svg
                                                                                className="h-2 w-2 text-white"
                                                                                fill="none"
                                                                                strokeWidth="2"
                                                                                stroke="currentColor"
                                                                                viewBox="0 0 24 24"
                                                                            >
                                                                                <polyline points="20 6 9 17 4 12" />
                                                                            </svg>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {file.status === "error" && (
                                                                    <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                                                                        <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                                                                            <X className="h-2 w-2 text-white" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-sm font-medium truncate">
                                                                        {file.fileName}
                                                                    </p>
                                                                    {file.status === "uploading" && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-5 w-5 p-0"
                                                                            onClick={() => handleCancelUpload(file.id)}
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {file.status === "uploading" && "Uploading..."}
                                                                    {file.status === "processing" && "Processing..."}
                                                                    {file.status === "complete" && "Complete"}
                                                                    {file.status === "error" && (
                                                                        <span className="text-red-500">{file.error || "Upload failed"}</span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}
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
                    </div>
                </div>

                {/* Main Content */}
                <div className="px-6 py-4 max-w-[1400px] mx-auto">
                    {/* Search bar is always shown */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search for visually similar content... (Press Enter to search)"
                            className="pl-10 pr-10"
                            value={searchQuery}
                            onChange={handleInputChange}
                            onKeyPress={handleKeyPress}
                        />
                        {searchQuery && (
                            <button
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Analysis section */}
                    <div
                        className={cn(
                            "overflow-hidden transition-all duration-500",
                            showAnalysis ? "h-auto opacity-100 mt-4 mb-2" : "h-0 opacity-0"
                        )}
                    >
                        <div className="bg-muted/50 rounded-lg p-4">
                            <div className="relative">
                                <p className="text-sm leading-relaxed">
                                    {isSearching ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Analyzing results...
                                        </span>
                                    ) : searchResults?.analysis}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="border-0 bg-card">
                        {isSearching || isLoading ? (
                            <LoadingSkeleton />
                        ) : (
                            <DataTable
                                columns={columns}
                                disableSearch
                                data={searchResults?.results || records || []}
                                searchPlaceholder="Filter results..."
                                onRowClick={(record) => {
                                    if (record.type === 'video') {
                                        router.push(`/library/video/${record.id}`);
                                    } else {
                                        router.push(`/library/${record.id}`);
                                    }
                                }}
                                filters={[
                                    {
                                        id: "sentiment_confidence",
                                        label: "Confidence Range",
                                        type: "range",
                                        value: confidenceRange,
                                        filterFn: (row, id, value) => {
                                            if (!value) return true;
                                            const [min, max] = value as [number, number];
                                            const confidence = row.getValue<number>(id);
                                            return confidence >= min / 100 && confidence <= max / 100;
                                        },
                                        onValueChange: (value) => setConfidenceRange(value as [number, number]),
                                    },
                                    {
                                        id: "sentiment_tone",
                                        label: "Tones",
                                        type: "multiselect",
                                        options: allTones,
                                        value: selectedTones,
                                        filterFn: (row, id, value) => {
                                            if (!value || (Array.isArray(value) && value.length === 0)) return true;
                                            const tones = row.getValue<string[]>(id);
                                            return tones.some(tone => value.includes(tone.toLowerCase()));
                                        },
                                        onValueChange: (value) => setSelectedTones(value as string[]),
                                    },
                                ]}
                                globalFilter={{
                                    placeholder: "Search your creative library...",
                                    searchFn: (row, id, value) => {
                                        const searchValue = (value as string).toLowerCase();
                                        const name = String(row.getValue("name") || "").toLowerCase();
                                        const description = String(row.getValue("image_description") || "").toLowerCase();
                                        return name.includes(searchValue) || description.includes(searchValue);
                                    },
                                }}
                                maxRowsPerPage={6}
                            />
                        )}
                    </div>
                </div>
            </>
        </div>
    );
} 