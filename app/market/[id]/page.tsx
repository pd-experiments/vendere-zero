"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

type MarketSegment = {
    name: string;
    pain_points: string[];
    preferences: string[];
    characteristics: string[];
};

type PricePoint = {
    range_min: number;
    range_max: number;
    target_segment: string;
    value_proposition: string;
};

type KeyFeature = {
    name: string;
    importance_score: number;
    mentioned_benefits: string[];
};

type MarketItem = {
    id: string;
    imageUrl: string;
    siteUrl: string;
    intentSummary: string;
    primaryIntent: string;
    secondaryIntents: string[];
    buyingStage: string;
    competitorBrands: string[];
    keyFeatures: KeyFeature[];
    keywords: string[];
    marketSegments: MarketSegment[];
    pricePoints: PricePoint[];
    seasonalFactors: string[];
    created_at: string;
};

const LoadingSkeleton = () => (
    <div className="min-h-screen bg-background">
        <div className="px-4 py-4">
            {/* Header Skeleton */}
            <div className="mx-auto mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-48" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div className="mx-auto grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                    <Skeleton className="aspect-video w-full" />
                    <div className="border bg-card">
                        <div className="px-4 py-2 border-b">
                            <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="p-4 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    <div className="border bg-card">
                        <div className="px-4 py-2 border-b">
                            <Skeleton className="h-4 w-32" />
                        </div>
                        <div className="p-4">
                            <Skeleton className="h-[400px] w-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const getSiteInfo = (url: string) => {
    try {
        const urlObj = new URL(url);
        return {
            domain: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            faviconUrl: `https://${urlObj.hostname}/favicon.ico`
        };
    } catch (e) {
        return {
            domain: String(e),
            path: String(e),
            faviconUrl: '/placeholder-favicon.png'
        };
    }
};

export default function MarketDetail({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [record, setRecord] = useState<MarketItem | null>(null);
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

        try {
            const { data, error } = await supabase
                .from('citation_research')
                .select('*')
                .eq('id', params.id)
                .eq('user_id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                const marketItem: MarketItem = {
                    id: data.id,
                    imageUrl: data.image_url,
                    siteUrl: data.site_url,
                    intentSummary: data.intent_summary,
                    primaryIntent: data.primary_intent,
                    secondaryIntents: data.secondary_intents || [],
                    buyingStage: data.buying_stage,
                    competitorBrands: data.competitor_brands || [],
                    keyFeatures: data.key_features || [],
                    keywords: data.keywords || [],
                    marketSegments: data.market_segments || [],
                    pricePoints: Array.isArray(data.price_points) ? data.price_points : [],
                    seasonalFactors: data.seasonal_factors || [],
                    created_at: data.created_at
                };
                setRecord(marketItem);
            }
        } catch (error) {
            console.error("Error fetching record:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (!record) {
        return <div className="min-h-screen p-8 bg-background">Record not found</div>;
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(price);
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="px-4 py-4">
                {/* Header */}
                <div className="mx-auto mb-6">
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
                            <h1 className="text-2xl font-semibold">Market Research Details</h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Created {new Date(record.created_at).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="mx-auto grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                        {/* Site Info */}
                        <div className="bg-card border">
                            <div className="px-4 py-2 border-b bg-muted/50">
                                <h2 className="font-medium">Source</h2>
                            </div>
                            <div className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative h-5 w-5 flex-none">
                                        <img
                                            src={getSiteInfo(record.siteUrl).faviconUrl}
                                            alt="Site Icon"
                                            className="rounded-full w-5 h-5"
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = '/placeholder-favicon.png';
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {getSiteInfo(record.siteUrl).domain}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {getSiteInfo(record.siteUrl).path}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Intent Summary */}
                        <div className="bg-card border">
                            <div className="px-4 py-2 border-b bg-muted/50">
                                <h2 className="font-medium">Intent Summary</h2>
                            </div>
                            <div className="p-4">
                                <p className="text-sm text-muted-foreground">{record.intentSummary}</p>
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="bg-card border">
                            <div className="px-4 py-2 border-b bg-muted/50">
                                <h2 className="font-medium">Basic Information</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Buying Stage</h3>
                                    <span className="text-sm text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                                        {record.buyingStage}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium mb-2">Price Points</h3>
                                    <div className="space-y-2">
                                        {record.pricePoints.map((price, index) => (
                                            <div key={index} className="border bg-muted/50 p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium">
                                                        {formatPrice(price.range_min)} - {formatPrice(price.range_max)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {price.target_segment}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {price.value_proposition}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        <div className="bg-card border">
                            <div className="px-4 py-2 border-b bg-muted/50">
                                <h2 className="font-medium">Profile</h2>
                            </div>
                            <Tabs defaultValue="segments" className="w-full">
                                <div className="px-4 pt-4">
                                    <TabsList className="mb-4 w-full justify-start h-auto gap-2 bg-transparent p-0 flex-wrap shrink-0">
                                        <TabsTrigger value="segments" className="data-[state=active]:bg-primary/10 px-3 py-1.5 text-xs">
                                            Market Segments
                                        </TabsTrigger>
                                        <TabsTrigger value="features" className="data-[state=active]:bg-primary/10 px-3 py-1.5 text-xs">
                                            Key Features
                                        </TabsTrigger>
                                        <TabsTrigger value="competition" className="data-[state=active]:bg-primary/10 px-3 py-1.5 text-xs">
                                            Competition
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="segments" className="px-4 space-y-6">
                                    {record.marketSegments.map((segment, index) => (
                                        <div key={index} className="border bg-muted/50 p-4">
                                            <h3 className="text-sm font-medium mb-4">{segment.name}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Characteristics</h4>
                                                    <ul className="space-y-2">
                                                        {segment.characteristics.map((char, i) => (
                                                            <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
                                                                {char}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Pain Points</h4>
                                                    <ul className="space-y-2">
                                                        {segment.pain_points.map((point, i) => (
                                                            <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5" />
                                                                {point}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-medium text-muted-foreground mb-2">Preferences</h4>
                                                    <ul className="space-y-2">
                                                        {segment.preferences.map((pref, i) => (
                                                            <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5" />
                                                                {pref}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </TabsContent>

                                {record.keyFeatures.length > 0 && (
                                    <TabsContent value="features" className="px-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {record.keyFeatures.map((feature, index) => (
                                                <div key={index} className="border bg-muted/50 p-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium">{feature.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {(feature.importance_score * 100).toFixed(0)}% importance
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {feature.mentioned_benefits.map((benefit, i) => (
                                                            <p key={i} className="text-sm text-muted-foreground pl-3 border-l">
                                                                {benefit}
                                                            </p>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </TabsContent>
                                )}

                                {(record.competitorBrands.length > 0 || record.seasonalFactors.length > 0) && (
                                    <TabsContent value="competition" className="px-4 pb-4 space-y-4">
                                        {record.competitorBrands.length > 0 && (
                                            <div className="border bg-muted/50 p-3 space-y-2">
                                                <h3 className="text-sm font-medium mb-3">Competitor Brands</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {record.competitorBrands.map((brand, index) => (
                                                        <span key={index} className="text-sm text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                                                            {brand}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {record.seasonalFactors.length > 0 && (
                                            <div className="border bg-muted/50 p-3 space-y-2">
                                                <h3 className="text-sm font-medium mb-3">Seasonal Factors</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {record.seasonalFactors.map((factor, index) => (
                                                        <span key={index} className="text-sm text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                                                            {factor}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </TabsContent>
                                )}
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
