"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Video, MoreHorizontal, Trash2, Image as ImageIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LibraryItem = {
    id: string;
    type: "image" | "video";
    name: string | null;
    image_url?: string;
    video?: {
        id: string;
        name: string;
        description: string | null;
    };
    image_description: string;
    features: string[];
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



type PaginatedResponse = {
    items: LibraryItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export default function Library() {
    const router = useRouter();
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [confidenceRange, setConfidenceRange] = useState<[number, number]>([0, 100]);
    const [selectedTones, setSelectedTones] = useState<string[]>([]);
    const [records, setRecords] = useState<LibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([1]));
    const [cachedRecords, setCachedRecords] = useState<Record<number, LibraryItem[]>>({});
    const [selectedType, setSelectedType] = useState<string[]>([]);

    useEffect(() => {
        const fetchLibraryData = async (pageToLoad: number) => {
            setIsLoading(!cachedRecords[pageToLoad]);
            try {
                const response = await fetch(`/api/library?page=${pageToLoad}&pageSize=${pageSize}`);
                if (!response.ok) throw new Error("Failed to fetch library data");
                const data: PaginatedResponse = await response.json();

                setCachedRecords(prev => ({
                    ...prev,
                    [pageToLoad]: data.items
                }));
                setLoadedPages(prev => new Set(prev).add(pageToLoad));

                if (pageToLoad === page) {
                    setRecords(data.items);
                    setTotal(data.total);
                }
            } catch (error) {
                console.error("Error fetching library data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        // Load current page if not cached
        if (!cachedRecords[page]) {
            fetchLibraryData(page);
        } else {
            setRecords(cachedRecords[page]);
        }
    }, [page, pageSize]);

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
                            <div className="relative w-10 h-10 border-2 border-background rounded-md overflow-hidden bg-muted flex items-center justify-center">
                                <Video className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>
                    ) : (
                        row.original.image_url && (
                            <div className="w-10 h-10 relative border-2 border-background rounded-md overflow-hidden hover:scale-105 transition-transform">
                                <Image
                                    src={row.original.image_url}
                                    alt={row.original.name || "Image"}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        )
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
                            key={feature}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="font-medium min-w-[80px] truncate">
                                {feature}
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


    // Add this function to handle background loading of pages
    const handleLoadPage = async (pageToLoad: number) => {
        if (loadedPages.has(pageToLoad)) return;

        try {
            const response = await fetch(`/api/library?page=${pageToLoad}&pageSize=${pageSize}`);
            if (!response.ok) throw new Error("Failed to fetch library data");
            const data: PaginatedResponse = await response.json();

            setCachedRecords(prev => ({
                ...prev,
                [pageToLoad]: data.items
            }));
            setLoadedPages(prev => new Set(prev).add(pageToLoad));
        } catch (error) {
            console.error("Error fetching library data:", error);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="px-4 mx-auto">
                <div className="border-0 bg-card">
                    <DataTable
                        columns={columns}
                        data={records}
                        isLoading={isLoading}
                        searchPlaceholder="Find content in your library..."
                        loadedPages={loadedPages}
                        onLoadPage={handleLoadPage}
                        serverSidePagination={{
                            page,
                            pageSize,
                            total,
                            onPageChange: (newPage) => {
                                setPage(newPage);
                                if (cachedRecords[newPage]) {
                                    setRecords(cachedRecords[newPage]);
                                }
                            },
                            onPageSizeChange: setPageSize
                        }}
                        onRowClick={(record) => {
                            if (record.type === 'video') {
                                router.push(`/library/video/${record.id}`);
                            } else {
                                router.push(`/library/${record.id}?image_url=${encodeURIComponent(record.image_url || '')}`);
                            }
                        }}
                        filters={[
                            {
                                id: "type",
                                label: "Type",
                                type: "multiselect",
                                options: ["video", "image"],
                                value: selectedType,
                                filterFn: (row, id, value) => {
                                    if (!value || (Array.isArray(value) && value.length === 0)) return true;
                                    const type = row.getValue<string>(id);
                                    return value.includes(type);
                                },
                                onValueChange: (value) => setSelectedType(value as string[]),
                            },
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
                        uploadButton={{
                            onFileUpload: handleFileUpload,
                            onCancelUpload: handleCancelUpload,
                            uploadingFiles
                        }}
                    />
                </div>
            </div>
        </div>
    );
} 