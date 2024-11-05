"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

type VideoRow = {
    id: string;
    name: string;
    description: string | null;
    video_url: string;
    created_at: string | null;
    user_id: string | null;
};

type FrameRow = {
    id: string;
    image_url: string;
    image_description: string;
    user: string | null;
};

type VideoFrameMapping = {
    id: string;
    frame_number: number;
    video_timestamp: unknown;
    frame_id: string;
    video_id: string;
    user_id: string | null;
    created_at: string | null;
};

type Feature = {
    id: string;
    ad_output_id: string;
    keyword: string;
    confidence_score: number;
    category: string;
    location: string;
    user: string | null;
    visual_attributes: Array<{
        id: string;
        attribute: string;
        value: string;
        feature_id: string;
    }>;
};

type SentimentAnalysis = {
    id: string;
    ad_output_id: string;
    tone: string;
    confidence: number;
    user: string | null;
};

type VideoDetails = {
    id: string;
    name: string;
    description: string | null;
    video_url: string;
    frames: Array<{
        id: string;
        frame_number: number;
        video_timestamp: unknown;
        image_url: string;
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
            tone: string;
            confidence: number;
        };
    }>;
    created_at: string;
};

// Extended types for query results
type VideoWithFrames = VideoRow & {
    video_frames_mapping: Array<
        VideoFrameMapping & {
            frame: FrameRow;
        }
    >;
};

const LoadingSkeleton = () => (
    <div className="min-h-screen bg-background">
        <div className="px-6 py-4">
            {/* Header Skeleton */}
            <div className="max-w-[1400px] mx-auto mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8" /> {/* Back button */}
                        <div>
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-5 w-5" /> {/* Video icon */}
                                <Skeleton className="h-8 w-48" /> {/* Title */}
                            </div>
                            <Skeleton className="h-4 w-64 mt-1" /> {/* Description */}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="max-w-[1400px] mx-auto">
                {/* Frame Navigation Skeleton */}
                <div className="mb-6 border bg-card p-4">
                    <div className="grid grid-cols-6 gap-2">
                        {Array(6).fill(0).map((_, i) => (
                            <Skeleton key={i} className="aspect-video w-full" />
                        ))}
                    </div>
                </div>

                {/* Frame Details Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                        <Skeleton className="aspect-video w-full" />

                        <div className="border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/50">
                                <Skeleton className="h-5 w-24" />
                            </div>
                            <div className="p-4 space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-4 w-3/5" />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        {/* Sentiment Analysis Skeleton */}
                        <div className="border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/50">
                                <Skeleton className="h-5 w-36" />
                            </div>
                            <div className="p-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-2 flex-1" />
                                    <Skeleton className="h-5 w-32" />
                                </div>
                            </div>
                        </div>

                        {/* Features Skeleton */}
                        <div className="border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/50">
                                <Skeleton className="h-5 w-32" />
                            </div>
                            <div className="p-4">
                                <div className="grid gap-2 sm:grid-cols-1 xl:grid-cols-2">
                                    {Array(4).fill(0).map((_, i) => (
                                        <div key={i} className="border bg-muted/50 p-3 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-1.5">
                                                    <Skeleton className="h-5 w-24" />
                                                    <Skeleton className="h-4 w-16" />
                                                </div>
                                                <Skeleton className="h-4 w-12" />
                                            </div>
                                            <div className="space-y-2">
                                                <Skeleton className="h-4 w-32" />
                                                <div className="pl-2 border-l-2 border-muted space-y-1">
                                                    <Skeleton className="h-4 w-28" />
                                                    <Skeleton className="h-4 w-24" />
                                                    <Skeleton className="h-4 w-32" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default function VideoDetail({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [video, setVideo] = useState<VideoDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedFrame, setSelectedFrame] = useState<number>(0);

    useEffect(() => {
        fetchVideoDetails();
    }, [params.id]);

    const fetchVideoDetails = async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("Error getting user:", userError);
            setLoading(false);
            return;
        }

        // Use VideoWithFrames type for the video query
        const { data: videoData, error: videoError } = await supabase
            .from('videos')
            .select<string, VideoWithFrames>(`
                id,
                name,
                description,
                video_url,
                created_at,
                user_id,
                video_frames_mapping!video_frames_mapping_video_id_fkey (
                    id,
                    frame_number,
                    video_timestamp,
                    frame_id,
                    video_id,
                    user_id,
                    created_at,
                    frame:ad_structured_output!video_frames_mapping_frame_id_fkey (
                        id,
                        image_url,
                        image_description,
                        user
                    )
                )
            `)
            .eq('id', params.id)
            .eq('user_id', user.id)
            .single();

        if (videoError || !videoData) {
            console.error("Error fetching video:", videoError);
            setLoading(false);
            return;
        }

        // Fetch features and sentiments for all frames
        const frameIds = videoData.video_frames_mapping.map(m => m.frame.id);

        const { data: features, error: featuresError } = await supabase
            .from('features')
            .select<string, Feature>(`
                *,
                visual_attributes (*)
            `)
            .in('ad_output_id', frameIds)
            .eq('user', user.id);

        if (featuresError) {
            console.error("Error fetching features:", featuresError);
        }

        const { data: sentiments, error: sentimentsError } = await supabase
            .from('sentiment_analysis')
            .select<string, SentimentAnalysis>('*')
            .in('ad_output_id', frameIds)
            .eq('user', user.id);

        if (sentimentsError) {
            console.error("Error fetching sentiments:", sentimentsError);
        }

        // Transform the data
        const videoDetails: VideoDetails = {
            id: videoData.id,
            name: videoData.name,
            description: videoData.description,
            video_url: videoData.video_url,
            created_at: new Date().toISOString(),
            frames: videoData.video_frames_mapping
                .sort((a, b) => a.frame_number - b.frame_number)
                .map(mapping => ({
                    id: mapping.frame.id,
                    frame_number: mapping.frame_number,
                    video_timestamp: mapping.video_timestamp,
                    image_url: mapping.frame.image_url,
                    image_description: mapping.frame.image_description,
                    features: features
                        ?.filter(f => f.ad_output_id === mapping.frame.id)
                        .map(feature => ({
                            keyword: feature.keyword,
                            confidence_score: feature.confidence_score,
                            category: feature.category,
                            location: feature.location,
                            visual_attributes: feature.visual_attributes?.map(attr => ({
                                attribute: attr.attribute,
                                value: attr.value
                            }))
                        })) || [],
                    sentiment_analysis: sentiments?.find(s => s.ad_output_id === mapping.frame.id) || {
                        tone: '',
                        confidence: 0
                    }
                }))
        };

        setVideo(videoDetails);
        setLoading(false);
    };

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (!video) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-semibold">Video Not Found</h2>
                    <p className="text-muted-foreground">
                        The video you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => router.back()}
                        className="mt-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const currentFrame = video.frames[selectedFrame];

    return (
        <div className="min-h-screen bg-background">
            <div className="px-6 py-4">
                {/* Header */}
                <div className="max-w-[1400px] mx-auto mb-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-2xl font-semibold">
                            {video.name}
                        </h1>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-[1400px] mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column - Video and Timeline */}
                        <div>
                            {/* Video Player */}
                            <div className="border bg-card">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Video Preview</h2>
                                </div>
                                <div className="p-4">
                                    <div className="aspect-video bg-black">
                                        <video
                                            src={video.video_url}
                                            controls
                                            className="w-full h-full"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="mt-6 border bg-card">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Timeline</h2>
                                </div>
                                <div className="p-4">
                                    <ScrollArea className="w-full" orientation="horizontal">
                                        <div className="flex gap-2 min-w-full pb-2">
                                            {video.frames.map((frame, index) => (
                                                <button
                                                    key={frame.id}
                                                    onClick={() => setSelectedFrame(index)}
                                                    className={`relative flex-shrink-0 w-20 border ${
                                                        selectedFrame === index
                                                            ? "border-primary"
                                                            : "border-border hover:border-primary/50"
                                                    }`}
                                                >
                                                    <div className="aspect-video relative">
                                                        <Image
                                                            src={frame.image_url}
                                                            alt={`Frame ${frame.frame_number}`}
                                                            layout="fill"
                                                            objectFit="cover"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                        <div className="absolute bottom-1 right-1 text-white text-xs">
                                                            {frame.frame_number}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>

                            {/* Video Description */}
                            <div className="mt-6 border bg-card">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Video Description</h2>
                                </div>
                                <div className="p-4">
                                    <p className="text-muted-foreground">
                                        {video.description || 'No description available'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Frame Analysis */}
                        <div>
                            {/* Current Frame Preview */}
                            <div className="border bg-card">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Frame {currentFrame.frame_number}</h2>
                                </div>
                                <div className="p-4">
                                    <div className="aspect-video relative bg-black">
                                        <Image
                                            src={currentFrame.image_url}
                                            alt={`Frame ${currentFrame.frame_number}`}
                                            layout="fill"
                                            objectFit="contain"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Frame Description */}
                            <div className="mt-6 border bg-card">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Frame Description</h2>
                                </div>
                                <div className="p-4">
                                    <p className="text-muted-foreground">
                                        {currentFrame.image_description}
                                    </p>
                                </div>
                            </div>

                            {/* Sentiment Analysis */}
                            <div className="mt-6 border bg-card">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Sentiment Analysis</h2>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center gap-4">
                                        <span className="text-base capitalize">
                                            {currentFrame.sentiment_analysis.tone}
                                        </span>
                                        <div className="flex-1">
                                            <Progress
                                                value={currentFrame.sentiment_analysis.confidence * 100}
                                                className="h-2"
                                            />
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {(currentFrame.sentiment_analysis.confidence * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Visual Features */}
                            <div className="mt-6 border bg-card">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Visual Features</h2>
                                </div>
                                <div className="p-4">
                                    <div className="grid gap-3 sm:grid-cols-1 xl:grid-cols-2">
                                        {currentFrame.features.map((feature, index) => (
                                            <div
                                                key={index}
                                                className="border bg-muted/50 p-3"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium">
                                                            {feature.keyword}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground">
                                                            ({feature.category})
                                                        </span>
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">
                                                        {(feature.confidence_score * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-2">
                                                    <p>Location: {feature.location}</p>
                                                    {feature.visual_attributes && 
                                                     feature.visual_attributes.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2 pl-2 border-l-2 border-muted">
                                                            {feature.visual_attributes.map((attr) => (
                                                                <span
                                                                    key={attr.attribute}
                                                                    className="inline-flex items-center text-xs bg-muted/40 px-1.5 py-0.5"
                                                                >
                                                                    <span className="text-muted-foreground">
                                                                        {attr.attribute}:
                                                                    </span>
                                                                    <span className="ml-1 font-medium">
                                                                        {attr.value}
                                                                    </span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 