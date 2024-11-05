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

// Extend database types for video frames
type VideoFrameMapping = Database['public']['Tables']['video_frames_mapping']['Row'] & {
    frame: Database['public']['Tables']['ad_structured_output']['Row'];
};

type VideoWithFrames = Database['public']['Tables']['videos']['Row'] & {
    video_frames_mapping: VideoFrameMapping[];
    video_url: string;
};

type StandaloneImage = Database['public']['Tables']['ad_structured_output']['Row'] & {
    video_frames_mapping: Pick<Database['public']['Tables']['video_frames_mapping']['Row'], 'id'>[] | null;
};

// Update LibraryItem type to have an array of tones
type LibraryItem = {
    id: string;
    type: 'image' | 'video';
    image_url?: string;
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

// Add UploadingFile type definition
type UploadingFile = {
    id: string;
    fileName: string;
    file: File;
    fileType: "image" | "video";
    status: "uploading" | "processing" | "complete" | "error";
    error?: string;
    progress?: number;
};

// Add FeatureWithAttributes type definition
type FeatureWithAttributes = Database['public']['Tables']['features']['Row'] & {
    visual_attributes: Database['public']['Tables']['visual_attributes']['Row'][];
};

export default function Library() {
    const router = useRouter();
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [records, setRecords] = useState<LibraryItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch user's records on mount
    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        setLoading(true);
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("Error getting user:", userError);
            setLoading(false);
            return;
        }

        // Fetch videos with frames
        const { data: videos, error: videosError } = await supabase
            .from('videos')
            .select<string, VideoWithFrames>(`
                id,
                name,
                description,
                video_url,
                video_frames_mapping!video_frames_mapping_video_id_fkey (
                    id,
                    frame_number,
                    video_timestamp,
                    frame_id,
                    frame:ad_structured_output!video_frames_mapping_frame_id_fkey (
                        id,
                        image_url,
                        image_description
                    )
                )
            `)
            .eq('user_id', user.id);

        if (videosError) {
            console.error("Error fetching videos:", videosError);
            setLoading(false);
            return;
        }

        // Fetch standalone images
        const { data: standaloneImages, error: imagesError } = await supabase
            .from('ad_structured_output')
            .select<string, StandaloneImage>(`
                id,
                image_url,
                image_description,
                video_frames_mapping!video_frames_mapping_frame_id_fkey (id)
            `)
            .eq('user', user.id)
            .is('video_frames_mapping', null);

        if (imagesError) {
            console.error("Error fetching images:", imagesError);
            setLoading(false);
            return;
        }

        // Fetch features with visual attributes
        const { data: features, error: featuresError } = await supabase
            .from('features')
            .select<string, FeatureWithAttributes>(`
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
            .eq('user', user.id);

        if (featuresError || !features) {
            console.error("Error fetching features:", featuresError);
            setLoading(false);
            return;
        }

        // Fetch sentiment analysis
        const { data: sentiments, error: sentimentError } = await supabase
            .from('sentiment_analysis')
            .select<string, Database['public']['Tables']['sentiment_analysis']['Row']>()
            .eq('user', user.id);

        if (sentimentError || !sentiments) {
            console.error("Error fetching sentiments:", sentimentError);
            setLoading(false);
            return;
        }

        // Transform the data into LibraryItems
        const libraryItems: LibraryItem[] = [
            // Add videos
            ...(videos?.map(video => ({
                id: video.id,
                type: 'video' as const,
                video: {
                    id: video.id,
                    name: video.name,
                    description: video.description,
                    video_url: video.video_url,
                    frames: video.video_frames_mapping
                        .sort((a, b) => a.frame_number - b.frame_number)
                        .map(mapping => ({
                            mapping_id: mapping.id,
                            frame_id: mapping.frame_id,
                            image_url: mapping.frame.image_url,
                            image_description: mapping.frame.image_description,
                            frame_number: mapping.frame_number,
                            video_timestamp: mapping.video_timestamp,
                        }))
                },
                image_description: video.description || 'No description',
                features: features
                    .filter(f => video.video_frames_mapping.some(m => m.frame_id === f.ad_output_id))
                    .map(feature => ({
                        keyword: feature.keyword,
                        confidence_score: feature.confidence_score,
                        category: feature.category,
                        location: feature.location,
                        visual_attributes: feature.visual_attributes
                    })),
                sentiment_analysis: {
                    tones: Array.from(new Set(
                        video.video_frames_mapping
                            .map(mapping => 
                                sentiments.find(s => s.ad_output_id === mapping.frame_id)?.tone
                            )
                            .filter(Boolean) as string[]
                    )),
                    confidence: video.video_frames_mapping.reduce((sum, mapping) => {
                        const frameSentiment = sentiments.find(s => s.ad_output_id === mapping.frame_id);
                        return sum + (frameSentiment?.confidence || 0);
                    }, 0) / (video.video_frames_mapping.length || 1)
                },
                created_at: video.created_at || new Date().toISOString()
            })) || []),
            // Add standalone images
            ...(standaloneImages?.map(image => ({
                id: image.id,
                type: 'image' as const,
                image_url: image.image_url,
                image_description: image.image_description,
                features: features
                    .filter(f => f.ad_output_id === image.id)
                    .map(feature => ({
                        keyword: feature.keyword,
                        confidence_score: feature.confidence_score,
                        category: feature.category,
                        location: feature.location,
                        visual_attributes: feature.visual_attributes
                    })),
                sentiment_analysis: {
                    // Single tone in array for images
                    tones: [sentiments.find(s => s.ad_output_id === image.id)?.tone || ''],
                    confidence: sentiments.find(s => s.ad_output_id === image.id)?.confidence || 0
                },
                created_at: new Date().toISOString()
            })) || [])
        ];

        setRecords(libraryItems);
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
            accessorKey: "preview",
            header: "Preview",
            cell: ({ row }) => (
                <div className="py-1">
                    {row.original.type === 'video' ? (
                        <div className="flex -space-x-2">
                            {row.original.video?.frames.slice(0, 3).map((frame, index) => (
                                <div 
                                    key={frame.frame_id} 
                                    className="relative w-10 h-10 border-2 border-background rounded-md overflow-hidden hover:scale-105 transition-transform"
                                    style={{ zIndex: 3 - index }}
                                >
                                    <Image
                                        src={frame.image_url}
                                        alt={`Frame ${frame.frame_number}`}
                                        layout="fill"
                                        objectFit="cover"
                                    />
                                </div>
                            ))}
                            {(row.original.video?.frames.length || 0) > 3 && (
                                <div 
                                    className="relative w-10 h-10 border-2 border-background rounded-md bg-muted/50 flex items-center justify-center"
                                    style={{ zIndex: 0 }}
                                >
                                    <span className="text-xs font-medium text-muted-foreground">
                                        +{(row.original.video?.frames.length || 0) - 3}
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
            accessorKey: "sentiment_tone",
            header: "Tone",
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
            accessorKey: "sentiment_confidence",
            header: "Confidence",
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

                        fetchRecords();
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
                        <div className="border-0 bg-card">
                            <DataTable
                                columns={columns}
                                data={records}
                                onRowClick={(record) => {
                                    if (record.type === 'video') {
                                        router.push(`/library/video/${record.id}`);
                                    } else {
                                        router.push(`/library/${record.id}`);
                                    }
                                }}
                                searchPlaceholder="Search your creative library..."
                                maxRowsPerPage={6}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
} 