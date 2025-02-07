"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2 } from "lucide-react";
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

type MarketSegment = {
    name: string;
    pain_points: string[];
    preferences: string[];
    characteristics: string[];
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
    keyFeatures: string[];
    keywords: string[];
    marketSegments: MarketSegment[];
    pricePoints: string[];
    seasonalFactors: string[];
    created_at: string;
};

type PaginatedResponse = {
    items: MarketItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

const faviconCache: Record<string, string> = {};

const getSiteInfo = (url: string) => {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        // Use cached favicon URL if available
        if (!faviconCache[domain]) {
            faviconCache[domain] = `https://${domain}/favicon.ico`;
        }

        return {
            domain: domain,
            path: urlObj.pathname + urlObj.search,
            faviconUrl: faviconCache[domain]
        };
    } catch (e) {
        return {
            domain: String(e),
            path: String(e),
            faviconUrl: '/placeholder-favicon.png'
        };
    }
};

export default function Market() {
    const router = useRouter();
    const [records, setRecords] = useState<MarketItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set([1]));
    const [cachedRecords, setCachedRecords] = useState<Record<number, MarketItem[]>>({});
    const [selectedBuyingStage, setSelectedBuyingStage] = useState<string[]>([]);
    const [selectedMarketSegments, setSelectedMarketSegments] = useState<string[]>([]);

    useEffect(() => {
        const fetchMarketData = async (pageToLoad: number) => {
            setIsLoading(!cachedRecords[pageToLoad]);
            try {
                const response = await fetch(`/api/market-fetch?page=${pageToLoad}&pageSize=${pageSize}`);
                if (!response.ok) throw new Error("Failed to fetch market data");
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
                console.error("Error fetching market data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (!cachedRecords[page]) {
            fetchMarketData(page);
        } else {
            setRecords(cachedRecords[page]);
        }
    }, [page, pageSize]);

    const columns: ColumnDef<MarketItem>[] = [
        {
            accessorKey: "source",
            header: "Source",
            cell: ({ row }) => {
                const siteInfo = getSiteInfo(row.original.siteUrl);
                const [imgSrc, setImgSrc] = useState(siteInfo.faviconUrl);

                // Handle favicon error only once
                const handleError = () => {
                    if (imgSrc !== '/placeholder-favicon.png') {
                        setImgSrc('/placeholder-favicon.png');
                        faviconCache[siteInfo.domain] = '/placeholder-favicon.png';
                    }
                };

                return (
                    <div className="py-1">
                        <div className="flex items-center gap-2">
                            <div className="relative h-4 w-4 flex-none">
                                <img
                                    src={imgSrc}
                                    alt="Site Icon"
                                    className="rounded-full w-4 h-4"
                                    onError={handleError}
                                />
                            </div>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {siteInfo.domain}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "path",
            header: "Path",
            cell: ({ row }) => {
                const siteInfo = getSiteInfo(row.original.siteUrl);
                return (
                    <div className="py-1">
                        <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
                            {siteInfo.path}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: "intentSummary",
            header: "Intent Summary",
            cell: ({ row }) => (
                <div className="py-1">
                    <p className="max-w-[280px] line-clamp-2 text-sm text-muted-foreground">
                        {row.original.intentSummary}
                    </p>
                </div>
            ),
        },
        {
            accessorKey: "buyingStage",
            header: "Buying Stage",
            cell: ({ row }) => (
                <div className="py-1">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted">
                        {row.original.buyingStage}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "marketSegments",
            header: "Market Segments",
            cell: ({ row }) => (
                <div className="py-1 space-y-1">
                    {row.original.marketSegments.slice(0, 2).map((segment, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                            <span className="text-sm text-muted-foreground">
                                {segment.name}
                            </span>
                        </div>
                    ))}
                    {row.original.marketSegments.length > 2 && (
                        <span className="text-xs text-muted-foreground pl-3">
                            +{row.original.marketSegments.length - 2} more
                        </span>
                    )}
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
                            .from("citation_research")
                            .delete()
                            .eq('id', row.original.id);

                        if (error) {
                            console.error("Error deleting record:", error);
                            return;
                        }
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

    const handleLoadPage = async (pageToLoad: number) => {
        if (loadedPages.has(pageToLoad)) return;

        try {
            const response = await fetch(`/api/market-fetch?page=${pageToLoad}&pageSize=${pageSize}`);
            if (!response.ok) throw new Error("Failed to fetch market data");
            const data: PaginatedResponse = await response.json();

            setCachedRecords(prev => ({
                ...prev,
                [pageToLoad]: data.items
            }));
            setLoadedPages(prev => new Set(prev).add(pageToLoad));
        } catch (error) {
            console.error("Error fetching market data:", error);
        }
    };

    // Get unique market segments for filters
    const allMarketSegments = Array.from(
        new Set(records.flatMap(item => item.marketSegments.map(segment => segment.name)))
    );
    const allBuyingStages = Array.from(
        new Set(records.map(item => item.buyingStage))
    );

    return (
        <div className="min-h-screen bg-background">
            <div className="px-4 mx-auto">
                <div className="border-0 bg-card">
                    <DataTable
                        columns={columns}
                        data={records}
                        isLoading={isLoading}
                        searchPlaceholder="Search market research..."
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
                            router.push(`/market/${record.id}`);
                        }}
                        filters={[
                            {
                                id: "buyingStage",
                                label: "Buying Stage",
                                type: "multiselect",
                                options: allBuyingStages,
                                value: selectedBuyingStage,
                                filterFn: (row, id, value) => {
                                    if (!value || (Array.isArray(value) && value.length === 0)) return true;
                                    const stage = row.getValue<string>(id);
                                    return value.includes(stage);
                                },
                                onValueChange: (value) => setSelectedBuyingStage(value as string[]),
                            },
                            {
                                id: "marketSegments",
                                label: "Market Segments",
                                type: "multiselect",
                                options: allMarketSegments,
                                value: selectedMarketSegments,
                                filterFn: (row, id, value) => {
                                    if (!value || (Array.isArray(value) && value.length === 0)) return true;
                                    const segments = row.getValue<MarketSegment[]>(id);
                                    return segments.some(segment => value.includes(segment.name));
                                },
                                onValueChange: (value) => setSelectedMarketSegments(value as string[]),
                            },
                        ]}
                        globalFilter={{
                            placeholder: "Search market research...",
                            searchFn: (row, id, value) => {
                                const searchValue = (value as string).toLowerCase();
                                const summary = String(row.getValue("intentSummary") || "").toLowerCase();
                                const segments = (row.getValue("marketSegments") as MarketSegment[])
                                    .map(segment => segment.name)
                                    .join(" ")
                                    .toLowerCase();
                                return summary.includes(searchValue) || segments.includes(searchValue);
                            },
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
