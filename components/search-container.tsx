"use client";

import { useState } from "react";
import { Loader2, GripVertical, TrashIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryItem } from "@/app/library/types";
import Link from "next/link";
import Image from "next/image";
import { Video, ImageIcon } from "lucide-react";

export function SearchContainer() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setIsExpanded(true);
        try {
            const response = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQuery }),
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

    const clearSearch = () => {
        setSearchQuery("");
        setSearchResults(null);
        setIsExpanded(false);
    };

    return (
        <div className={cn(
            "fixed bottom-[70px] right-6 z-50 transition-all duration-300 ease-in-out",
            "bg-muted/50 backdrop-blur supports-[backdrop-filter]:bg-muted/60",
            "rounded-lg shadow-lg border w-[400px]",
            !isExpanded && "h-[45px]"
        )}>
            <div className="py-1 px-3 space-y-1">
                <div className="flex justify-between items-start gap-3">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-muted-foreground hover:text-foreground mt-2.5 cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="relative flex-1">
                        <div className="relative flex items-start gap-3">
                            <textarea
                                placeholder="Search for visually similar content..."
                                className="flex-1 bg-transparent border-none focus:outline-none resize-none h-[42px] text-sm pt-2 pr-6"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSearch();
                                        setIsExpanded(true);
                                    }
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute right-0 top-2.5 text-muted-foreground hover:text-foreground text-sm font-medium"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {(isSearching || searchResults?.analysis) && isExpanded && (
                    <div className={cn(
                        "overflow-hidden transition-all duration-500 h-auto pb-2",
                    )}>
                        <div className="bg-muted/50 rounded-lg p-3">
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

                        {searchResults?.results && searchResults.results.length > 0 && !isSearching && (
                            <div className="mt-3 space-y-2">
                                {searchResults.results.map((result) => (
                                    <Link
                                        key={result.id}
                                        href={result.type === 'video' ? `/library/video/${result.id}` : `/library/${result.id}`}
                                        className="block"
                                    >
                                        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/80 transition-colors">
                                            <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                                                {result.type === 'video' ? (
                                                    <Video className="h-5 w-5 text-muted-foreground" />
                                                ) : result.image_url ? (
                                                    <Image
                                                        src={result.image_url}
                                                        alt={result.name || "Image"}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium truncate">
                                                        {result.name || 'Untitled'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {Math.round(result.similarity * 100)}% match
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {result.image_description}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export type SearchResult = LibraryItem & {
    similarity: number;
};

export type SearchResponse = {
    results: SearchResult[];
    analysis: string;
    query: string;
}; 