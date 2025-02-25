"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUpIcon, UsersIcon, TargetIcon, LayersIcon, MaximizeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type MarketPositioning = {
    strength: number;
    opportunity: string;
    competitors: string[];
    differentiators: string[];
};

type MarketOverview = {
    executive_summary: {
        key_findings: string[];
        strategic_recommendations: string[];
    };
    market_summary: {
        target_audiences: Array<{
            segment: string;
            details: {
                characteristics: string[];
                preferences: string[];
            };
            pain_points: string[];
            buying_stage: string;
            citations: string[];
        }>;
        competitive_landscape: {
            advantages: Record<string, string[]>;
            feature_comparison: Record<string, {
                importance_score: number;
                benefits: string[];
            }>;
            market_positioning: Record<string, MarketPositioning>;
        };
        key_features: Record<string, {
            benefits: string[];
            average_importance: number;
            frequency: number;
        }>;
        buying_stages: string[];
    };
    market_analysis: {
        trends: Record<string, string>;
        strategic_recommendations: string[];
    };
    keyword_insights: {
        analysis: Array<{
            keyword: string;
            intent: string;
            likelihood: number;
            citations: string[];
        }>;
    };
    metadata: {
        generated_at: string;
        user_id: string;
        filters_applied: Record<string, {
            segment?: string;
            stage?: string;
            timeframe?: string;
            competitors?: string[];
        }>;
        data_sources: string[];
    };
};

export default function Market() {
    const [marketData, setMarketData] = useState<MarketOverview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        const fetchMarketOverview = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("No user found");

                const { data, error } = await supabase
                    .from('markets_overview')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error) throw error;
                setMarketData(data.insights as MarketOverview);
            } catch (error) {
                console.error("Error fetching market overview:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMarketOverview();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 bg-muted" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-32 bg-muted" />
                        ))}
                    </div>
                    <div className="h-96 bg-muted" />
                </div>
            </div>
        );
    }

    if (!marketData) {
        return (
            <div className="min-h-screen bg-background p-6">
                <h1 className="text-2xl font-semibold mb-4">No market data available</h1>
                <p className="text-muted-foreground">Please generate market insights first.</p>
            </div>
        );
    }

    // Calculate performance metrics
    const performanceMetrics = {
        totalFeatures: Object.keys(marketData.market_summary.key_features).length,
        avgImportance: Object.values(marketData.market_summary.key_features)
            .reduce((acc, curr) => acc + curr.average_importance, 0) / Object.keys(marketData.market_summary.key_features).length,
        totalSegments: marketData.market_summary.target_audiences.length,
        competitiveAdvantages: Object.values(marketData.market_summary.competitive_landscape.advantages)
            .reduce((acc, curr) => acc + curr.length, 0),
    };

    // Group keywords by intent
    const keywordsByIntent = marketData.keyword_insights.analysis.reduce((acc, item) => {
        if (!acc[item.intent]) {
            acc[item.intent] = [];
        }
        acc[item.intent].push(item);
        return acc;
    }, {} as Record<string, typeof marketData.keyword_insights.analysis>);

    // Helper function to extract domain from URL
    const extractDomain = (url: string): string => {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return domain.split('.')[0]; // Return just the domain name without TLD
        } catch {
            return url; // Return the original string if it's not a valid URL
        }
    };

    // Helper function to get favicon URL
    const getFaviconUrl = (url: string): string => {
        try {
            const domain = new URL(url).origin;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
            return '';
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-semibold">Market Overview</h1>
                    <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(marketData.metadata.generated_at).toLocaleString()}
                    </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card className="border bg-card rounded-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-muted/50 px-4 py-2">
                            <CardTitle className="text-sm font-medium">Total Features</CardTitle>
                            <LayersIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{performanceMetrics.totalFeatures}</div>
                            <p className="text-xs text-muted-foreground">Unique product features identified</p>
                        </CardContent>
                    </Card>

                    <Card className="border bg-card rounded-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-muted/50 px-4 py-2">
                            <CardTitle className="text-sm font-medium">Average Importance</CardTitle>
                            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{(performanceMetrics.avgImportance * 100).toFixed(1)}%</div>
                            <p className="text-xs text-muted-foreground">Feature importance score</p>
                        </CardContent>
                    </Card>

                    <Card className="border bg-card rounded-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-muted/50 px-4 py-2">
                            <CardTitle className="text-sm font-medium">Market Segments</CardTitle>
                            <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{performanceMetrics.totalSegments}</div>
                            <p className="text-xs text-muted-foreground">Identified target segments</p>
                        </CardContent>
                    </Card>

                    <Card className="border bg-card rounded-none">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b bg-muted/50 px-4 py-2">
                            <CardTitle className="text-sm font-medium">Competitive Edges</CardTitle>
                            <TargetIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold">{performanceMetrics.competitiveAdvantages}</div>
                            <p className="text-xs text-muted-foreground">Competitive advantages</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content with Two Tabs */}
                <Tabs defaultValue="intelligence" className="w-full">
                    <div className="border-b mb-6">
                        <TabsList className="w-full justify-start h-auto gap-4 bg-transparent p-0">
                            <TabsTrigger
                                value="intelligence"
                                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm font-medium"
                            >
                                Market Intelligence
                            </TabsTrigger>
                            <TabsTrigger
                                value="keywords"
                                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm font-medium"
                            >
                                Keyword Insights
                            </TabsTrigger>
                            <TabsTrigger
                                value="audiences"
                                className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 text-sm font-medium"
                            >
                                Target Audiences
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Market Intelligence Tab */}
                    <TabsContent value="intelligence" className="mt-0 space-y-6">
                        {/* Key Findings and Market Trends in a grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Key Findings */}
                            <Card className="border bg-card rounded-none">
                                <CardHeader className="border-b bg-muted/50 px-4 py-2">
                                    <CardTitle>Key Findings</CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <ul className="space-y-2">
                                        {marketData.executive_summary.key_findings.map((finding, index) => (
                                            <li key={index} className="flex gap-2 items-start border bg-muted/50 p-4">
                                                <div className="h-2 w-2 bg-primary mt-2" />
                                                <span className="text-sm">{finding}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            {/* Market Trends - Condensed with Dialog */}
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Card className="border bg-card rounded-none cursor-pointer hover:bg-muted/10 transition-colors">
                                        <CardHeader className="border-b bg-muted/50 px-4 py-2 flex flex-row items-center justify-between">
                                            <CardTitle>Daily Market Recap</CardTitle>
                                            <span className="text-xs text-muted-foreground">
                                                Summarized at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </CardHeader>
                                        <CardContent className="p-6 h-[400px] overflow-hidden">
                                            <div className="space-y-4">
                                                <p className="text-base font-medium leading-relaxed">
                                                    {Object.keys(marketData.market_analysis.trends).length > 0 ? (
                                                        <>
                                                            {Object.entries(marketData.market_analysis.trends)[0][0]}: {' '}
                                                            {Object.entries(marketData.market_analysis.trends)[0][1].substring(0, 150)}
                                                            {Object.entries(marketData.market_analysis.trends)[0][1].length > 150 ? '...' : ''}
                                                        </>
                                                    ) : (
                                                        'No market trends available'
                                                    )}
                                                </p>
                                                {Object.keys(marketData.market_analysis.trends).length > 1 && (
                                                    <p className="text-sm text-muted-foreground mt-4">
                                                        +{Object.keys(marketData.market_analysis.trends).length - 1} more market trends
                                                    </p>
                                                )}
                                                <div className="flex justify-end mt-4">
                                                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                                                        <span>Read more</span>
                                                        <MaximizeIcon className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Market Trends Analysis</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-6 py-4">
                                        {Object.entries(marketData.market_analysis.trends).map(([question, answer], index) => (
                                            <div key={index} className="border bg-muted/50 p-4 space-y-2">
                                                <h3 className="text-sm font-medium">{question}</h3>
                                                <p className="text-sm text-muted-foreground">{answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </TabsContent>

                    {/* Keywords Tab */}
                    <TabsContent value="keywords" className="mt-0">
                        <div className="relative">
                            {/* Scroll hint indicator */}
                            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gradient-to-l from-background to-transparent w-12 h-full z-10 pointer-events-none flex items-center justify-end pr-2">
                                <div className="h-8 w-8 rounded-full bg-muted/80 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground animate-pulse">
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </div>
                            </div>

                            <div className="flex overflow-x-auto pb-6 pt-2 space-x-6 snap-x scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                                {Object.entries(keywordsByIntent).map(([intent, keywords]) => (
                                    <div key={intent} className="min-w-[300px] max-w-[350px] flex-shrink-0 snap-start border-t-2 border-muted pt-2">
                                        <h3 className="text-sm font-medium capitalize mb-3 sticky top-0 bg-background py-1">{intent}</h3>
                                        <div className="space-y-3">
                                            {keywords
                                                .sort((a, b) => b.likelihood - a.likelihood)
                                                .map((keyword, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between p-3 border bg-muted/50 relative"
                                                    >
                                                        <span className="text-sm truncate">{keyword.keyword}</span>
                                                        <div className="flex items-center gap-2">
                                                            {/* Citations display */}
                                                            {keyword.citations && keyword.citations.length > 0 && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="flex items-center cursor-pointer">
                                                                                {/* Display up to 2 favicons in a layered style */}
                                                                                <div className="flex relative">
                                                                                    {keyword.citations.slice(0, 2).map((citation, i) => (
                                                                                        <div
                                                                                            key={i}
                                                                                            className="w-4 h-4 rounded-full border border-background overflow-hidden bg-white"
                                                                                            style={{
                                                                                                marginLeft: i > 0 ? '-6px' : '0',
                                                                                                zIndex: 2 - i,
                                                                                                position: 'relative'
                                                                                            }}
                                                                                        >
                                                                                            <img
                                                                                                src={getFaviconUrl(citation)}
                                                                                                alt={extractDomain(citation)}
                                                                                                className="w-full h-full object-contain"
                                                                                                onError={(e) => {
                                                                                                    const target = e.target as HTMLImageElement;
                                                                                                    target.style.display = 'none';
                                                                                                    target.parentElement!.innerHTML = extractDomain(citation).charAt(0).toUpperCase();
                                                                                                    target.parentElement!.style.display = 'flex';
                                                                                                    target.parentElement!.style.alignItems = 'center';
                                                                                                    target.parentElement!.style.justifyContent = 'center';
                                                                                                    target.parentElement!.style.backgroundColor = '#f0f0f0';
                                                                                                    target.parentElement!.style.color = '#333';
                                                                                                }}
                                                                                            />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <div className="space-y-1 max-w-xs">
                                                                                <p className="text-xs font-medium">Sources:</p>
                                                                                <ul className="text-xs">
                                                                                    {keyword.citations.slice(0, 3).map((citation, i) => (
                                                                                        <li key={i} className="flex items-center gap-1">
                                                                                            <div className="w-3 h-3 rounded-full overflow-hidden bg-white">
                                                                                                <img
                                                                                                    src={getFaviconUrl(citation)}
                                                                                                    alt=""
                                                                                                    className="w-full h-full object-contain"
                                                                                                />
                                                                                            </div>
                                                                                            <span>{extractDomain(citation)}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                    {keyword.citations.length > 3 && (
                                                                                        <li className="text-xs text-muted-foreground">
                                                                                            +{keyword.citations.length - 3} more
                                                                                        </li>
                                                                                    )}
                                                                                </ul>
                                                                            </div>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                            <span
                                                                className={`text-xs px-2 py-1 ${keyword.likelihood >= 0.7
                                                                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                                                    : keyword.likelihood >= 0.4
                                                                        ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                                                                        : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                                                    }`}
                                                            >
                                                                {(keyword.likelihood * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Target Audiences Tab */}
                    <TabsContent value="audiences" className="mt-0">
                        <div className="space-y-6">
                            {marketData.market_summary.target_audiences.map((audience, index) => (
                                <div key={index} className="border bg-muted/50 p-4 relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-medium">{audience.segment}</h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1">
                                                {audience.buying_stage}
                                            </span>

                                            {/* Citations display - moved inside the header flex container */}
                                            {audience.citations && audience.citations.length > 0 && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center cursor-pointer">
                                                                {/* Display up to 3 favicons in a layered style */}
                                                                <div className="flex relative">
                                                                    {audience.citations.slice(0, 3).map((citation, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="w-5 h-5 rounded-full border border-background overflow-hidden bg-white"
                                                                            style={{
                                                                                marginLeft: i > 0 ? '-6px' : '0',
                                                                                zIndex: 3 - i,
                                                                                position: 'relative'
                                                                            }}
                                                                        >
                                                                            <img
                                                                                src={getFaviconUrl(citation)}
                                                                                alt={extractDomain(citation)}
                                                                                className="w-full h-full object-contain"
                                                                                onError={(e) => {
                                                                                    // If favicon fails to load, show the first letter of the domain
                                                                                    const target = e.target as HTMLImageElement;
                                                                                    target.style.display = 'none';
                                                                                    target.parentElement!.innerHTML = extractDomain(citation).charAt(0).toUpperCase();
                                                                                    target.parentElement!.style.display = 'flex';
                                                                                    target.parentElement!.style.alignItems = 'center';
                                                                                    target.parentElement!.style.justifyContent = 'center';
                                                                                    target.parentElement!.style.backgroundColor = '#f0f0f0';
                                                                                    target.parentElement!.style.color = '#333';
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Display the name of the top source */}
                                                                {audience.citations.length > 0 && (
                                                                    <span className="ml-1 text-xs text-muted-foreground">
                                                                        {extractDomain(audience.citations[0])}
                                                                        {audience.citations.length > 1 && ` +${audience.citations.length - 1}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="space-y-1 max-w-xs">
                                                                <p className="text-xs font-medium">Sources:</p>
                                                                <ul className="text-xs">
                                                                    {audience.citations.slice(0, 5).map((citation, i) => (
                                                                        <li key={i} className="flex items-center gap-1">
                                                                            <div className="w-3 h-3 rounded-full overflow-hidden bg-white">
                                                                                <img
                                                                                    src={getFaviconUrl(citation)}
                                                                                    alt=""
                                                                                    className="w-full h-full object-contain"
                                                                                />
                                                                            </div>
                                                                            <span>{extractDomain(citation)}</span>
                                                                        </li>
                                                                    ))}
                                                                    {audience.citations.length > 5 && (
                                                                        <li className="text-xs text-muted-foreground">
                                                                            +{audience.citations.length - 5} more
                                                                        </li>
                                                                    )}
                                                                </ul>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Characteristics */}
                                        <div>
                                            <h4 className="text-xs font-medium text-muted-foreground mb-2">Characteristics</h4>
                                            <ul className="space-y-2">
                                                {audience.details.characteristics.map((char, i) => (
                                                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                                        <span className="h-1.5 w-1.5 bg-primary mt-1.5" />
                                                        {char}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Preferences */}
                                        <div>
                                            <h4 className="text-xs font-medium text-muted-foreground mb-2">Preferences</h4>
                                            <ul className="space-y-2">
                                                {audience.details.preferences.map((pref, i) => (
                                                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                                        <span className="h-1.5 w-1.5 bg-blue-500 mt-1.5" />
                                                        {pref}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Pain Points */}
                                        <div>
                                            <h4 className="text-xs font-medium text-muted-foreground mb-2">Pain Points</h4>
                                            <ul className="space-y-2">
                                                {audience.pain_points.map((point, i) => (
                                                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                                        <span className="h-1.5 w-1.5 bg-red-500 mt-1.5" />
                                                        {point}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
