"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { type Database } from "@/lib/types/schema";

type AdRecord = {
    id: string;
    image_url: string;
    image_description: string;
    name?: string;
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

type AdOutput = Database['public']['Tables']['ad_structured_output']['Row'];
type Feature = Database['public']['Tables']['features']['Row'];
type VisualAttribute = Database['public']['Tables']['visual_attributes']['Row'];
type FeatureWithVisualAttributes = Feature & { visual_attributes: VisualAttribute[] };
type SentimentAnalysis = Database['public']['Tables']['sentiment_analysis']['Row'];

const LoadingSkeleton = () => (
    <div className="min-h-screen bg-background">
        <div className="px-6 py-4">
            {/* Header Skeleton */}
            <div className="max-w-[1400px] mx-auto mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-48" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="max-w-[1400px] mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Image Skeleton */}
                        <Skeleton className="aspect-video w-full" />

                        {/* Description Skeleton */}
                        <div className="border bg-card">
                            <div className="px-4 py-2 border-b">
                                <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="p-4 space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Sentiment Analysis Skeleton */}
                        <div className="border bg-card">
                            <div className="px-4 py-2 border-b">
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <div className="p-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-6 w-24" />
                                    <Skeleton className="h-2 flex-1" />
                                    <Skeleton className="h-4 w-16" />
                                </div>
                            </div>
                        </div>

                        {/* Features Grid Skeleton */}
                        <div className="border bg-card">
                            <div className="px-4 py-2 border-b">
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <div className="p-4">
                                <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
                                    {Array(4).fill(0).map((_, i) => (
                                        <div key={i} className="border p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <Skeleton className="h-5 w-32" />
                                                <Skeleton className="h-4 w-12" />
                                            </div>
                                            <Skeleton className="h-4 w-full mt-2" />
                                            <div className="mt-2 pl-2 border-l-2 border-muted">
                                                <Skeleton className="h-4 w-4/5" />
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

export default function AdDetail({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [record, setRecord] = useState<AdRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecord();
    }, [params.id]);

    const fetchRecord = async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("Error getting user:", userError);
            setLoading(false);
            return;
        }

        const { data: adOutput, error: adError } = await supabase
            .from('ad_structured_output')
            .select()
            .eq('id', params.id)
            .eq('user', user.id)
            .single<AdOutput>();

        if (adError || !adOutput) {
            console.error("Error fetching ad output:", adError);
            setLoading(false);
            return;
        }

        const { data: features } = await supabase
            .from('features')
            .select(`
                *,
                visual_attributes (*)
            `)
            .eq('ad_output_id', params.id)
            .eq('user', user.id)
            .select<'features', FeatureWithVisualAttributes>();

        const { data: sentiment } = await supabase
            .from('sentiment_analysis')
            .select('*')
            .eq('ad_output_id', params.id)
            .eq('user', user.id)
            .single<SentimentAnalysis>();

        const record: AdRecord = {
            id: adOutput.id,
            name: adOutput.name ?? 'Untitled',
            image_url: adOutput.image_url,
            image_description: adOutput.image_description,
            created_at: new Date().toISOString(),
            features: (features || []).map(feature => ({
                keyword: feature.keyword,
                confidence_score: feature.confidence_score,
                category: feature.category,
                location: feature.location,
                visual_attributes: feature.visual_attributes
            })),
            sentiment_analysis: sentiment || { tone: '', confidence: 0 }
        };

        setRecord(record);
        setLoading(false);
    };

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (!record) {
        return <div className="min-h-screen p-8 bg-background">Record not found</div>;
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="px-6 py-4">
                {/* Header */}
                <div className="max-w-[1400px] mx-auto mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => router.back()}
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-2xl font-semibold">{record.name ?? 'Untitled'}</h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Created {new Date(record.created_at).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-[1400px] mx-auto">
                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Column - Image and Description */}
                        <div className="space-y-4">
                            {/* Image */}
                            <div className="relative h-[500px] w-full bg-accent/50">
                                <Image
                                    src={record.image_url}
                                    alt="Analysis image"
                                    layout="fill"
                                    objectFit="contain"
                                    className="bg-accent/50"
                                />
                            </div>

                            {/* Description */}
                            <div className="bg-card border">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Description</h2>
                                </div>
                                <div className="p-4">
                                    <p className="text-muted-foreground">{record.image_description}</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Sentiment and Features */}
                        <div className="space-y-4">
                            {/* Sentiment Analysis */}
                            <div className="bg-card border">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Sentiment Analysis</h2>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center gap-4">
                                        <span className="text-base capitalize">{record.sentiment_analysis.tone}</span>
                                        <div className="flex-1">
                                            <Progress
                                                value={record.sentiment_analysis.confidence * 100}
                                                className="h-2"
                                            />
                                        </div>
                                        <span className="text-base text-muted-foreground">
                                            {(record.sentiment_analysis.confidence * 100).toFixed(0)}% confidence
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="bg-card border">
                                <div className="px-4 py-2 border-b bg-muted/50">
                                    <h2 className="font-medium">Visual Features</h2>
                                </div>
                                <div className="p-4">
                                    <div className="grid gap-2 sm:grid-cols-1 xl:grid-cols-2">
                                        {record.features.map((feature, index) => (
                                            <div
                                                key={index}
                                                className="bg-muted/50 border p-3 space-y-2"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium">{feature.keyword}</span>
                                                        <span className="text-sm text-muted-foreground">
                                                            ({feature.category})
                                                        </span>
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">
                                                        {(feature.confidence_score * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    <p>Location: {feature.location}</p>
                                                    {feature.visual_attributes && feature.visual_attributes.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-2 pl-2 border-l-2 border-muted">
                                                            {feature.visual_attributes.map((attr) => (
                                                                <span
                                                                    key={attr.attribute}
                                                                    className="inline-flex items-center text-xs bg-muted/40 px-1.5 py-0.5"
                                                                >
                                                                    <span className="text-muted-foreground">{attr.attribute}:</span>
                                                                    <span className="ml-1 font-medium">{attr.value}</span>
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