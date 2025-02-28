'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, FileText, Image as ImageIcon, Globe, Calendar, Tag, Clock, Info, ArrowRight, Link as LinkIcon } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';

export interface Source {
    id: string;
    text: string;
    score: number;
    extra_info: {
        type: 'ad' | 'market_research' | 'citation' | string;
        id: string;
        url?: string;
        image_url?: string;
        name?: string; // Source name
        domain?: string; // Source domain
    };
}

interface MessageSourcesProps {
    sources: Source[];
    citations?: string[];
}

interface SourceRecord {
    id: string;
    name?: string;
    image_url?: string;
    intent_summary?: string;
    description?: string;
    created_at?: string;
    keywords?: any[];
    buying_stage?: string;
    primary_intent?: string;
    site_url?: string;
    preview_url?: string;
    type?: string;
    features?: string[];
}

// Function to extract domain from URL
function extractDomain(url: string): string {
    try {
        const domain = new URL(url).hostname;
        return domain.replace(/^www\./, '');
    } catch (e) {
        return url;
    }
}

// Function to get favicon URL
function getFaviconUrl(domain: string): string {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

export function MessageSources({ sources, citations = [] }: MessageSourcesProps) {
    const [isVisible, setIsVisible] = useState(true);
    const [sourceRecords, setSourceRecords] = useState<Record<string, SourceRecord>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'citations' | 'sources'>('citations');
    const totalItems = sources.length + citations.length;

    useEffect(() => {
        async function fetchSourceRecords() {
            if (!sources || sources.length === 0) {
                setIsLoading(false);
                return;
            }

            const recordsMap: Record<string, SourceRecord> = {};

            // Group sources by type to batch fetch
            const marketResearchIds: string[] = [];
            const libraryItemIds: string[] = [];
            const citationResearchIds: string[] = [];

            sources.forEach(source => {
                const { type, id } = source.extra_info;
                if (type === 'market_research') marketResearchIds.push(id);
                else if (type === 'ad') libraryItemIds.push(id);
                else if (type === 'citation') citationResearchIds.push(id);
            });

            // Fetch market research records
            if (marketResearchIds.length > 0) {
                const { data: marketData } = await supabase
                    .from('market_research_v2')
                    .select('id, image_url, intent_summary, created_at, keywords, buying_stage')
                    .in('id', marketResearchIds);

                if (marketData) {
                    marketData.forEach(record => {
                        recordsMap[record.id] = record;
                    });
                }
            }

            // Fetch library items (ads)
            if (libraryItemIds.length > 0) {
                const { data: libraryData } = await supabase
                    .from('library_items')
                    .select('id, name, description, preview_url, features, created_at, type')
                    .in('item_id', libraryItemIds);

                if (libraryData) {
                    libraryData.forEach(record => {
                        recordsMap[record.id] = {
                            ...record,
                            id: record.id,
                            image_url: record.preview_url
                        };
                    });
                }
            }

            // Fetch citation research
            if (citationResearchIds.length > 0) {
                const { data: citationData } = await supabase
                    .from('citation_research')
                    .select('id, image_url, intent_summary, created_at, keywords, primary_intent, site_url, buying_stage')
                    .in('id', citationResearchIds);

                if (citationData) {
                    citationData.forEach(record => {
                        recordsMap[record.id] = record;
                    });
                }
            }

            setSourceRecords(recordsMap);
            setIsLoading(false);
        }

        fetchSourceRecords();
    }, [sources]);

    if (!totalItems) {
        return null;
    }

    return (
        <div className="mb-2">
            <div className="flex items-center justify-between mb-3">
                <Tabs defaultValue="citations" className="w-full" onValueChange={(value) => setActiveTab(value as 'citations' | 'sources')}>
                    <div className="flex items-center justify-between">
                        <TabsList className="h-auto bg-transparent p-0 gap-4 relative">
                            {/* Active tab indicator - animated background */}
                            {activeTab && (
                                <motion.div
                                    className="absolute bg-muted/50 border-[0.5px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] rounded-none"
                                    layoutId="tab-background"
                                    initial={false}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    style={{
                                        width: "var(--tab-width)",
                                        height: "var(--tab-height)",
                                        left: "var(--tab-left)",
                                        top: "var(--tab-top)",
                                    }}
                                />
                            )}

                            <TabsTrigger
                                value="citations"
                                className="relative rounded-sm px-3 py-1.5 text-xs font-medium flex items-center gap-2 z-10 data-[state=active]:bg-transparent"
                                ref={(el) => {
                                    if (el && activeTab === "citations") {
                                        const rect = el.getBoundingClientRect();
                                        document.documentElement.style.setProperty('--tab-width', `${rect.width}px`);
                                        document.documentElement.style.setProperty('--tab-height', `${rect.height}px`);
                                        document.documentElement.style.setProperty('--tab-left', `${el.offsetLeft}px`);
                                        document.documentElement.style.setProperty('--tab-top', `${el.offsetTop}px`);
                                    }
                                }}
                            >
                                <motion.span
                                    initial={{ opacity: 0.8 }}
                                    animate={{ opacity: activeTab === "citations" ? 1 : 0.8 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    Citations ({citations.length})
                                </motion.span>
                            </TabsTrigger>

                            <TabsTrigger
                                value="sources"
                                className="relative rounded-sm px-3 py-1.5 text-xs font-medium flex items-center gap-2 z-10 data-[state=active]:bg-transparent"
                                ref={(el) => {
                                    if (el && activeTab === "sources") {
                                        const rect = el.getBoundingClientRect();
                                        document.documentElement.style.setProperty('--tab-width', `${rect.width}px`);
                                        document.documentElement.style.setProperty('--tab-height', `${rect.height}px`);
                                        document.documentElement.style.setProperty('--tab-left', `${el.offsetLeft}px`);
                                        document.documentElement.style.setProperty('--tab-top', `${el.offsetTop}px`);
                                    }
                                }}
                            >
                                <motion.span
                                    initial={{ opacity: 0.8 }}
                                    animate={{ opacity: activeTab === "sources" ? 1 : 0.8 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    From Your Library ({sources.length})
                                </motion.span>
                            </TabsTrigger>
                        </TabsList>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs rounded-none text-white/50 hover:text-white/80"
                            onClick={() => setIsVisible(!isVisible)}
                        >
                            {isVisible ? 'Hide' : 'Show'}
                        </Button>
                    </div>

                    {isVisible && (
                        <div className="mt-3">
                            <TabsContent value="citations">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex overflow-x-auto gap-2 pb-2 no-scrollbar snap-x"
                                >
                                    {citations.map((citation, index) => (
                                        <CitationCard
                                            key={`citation-${index}`}
                                            citation={citation}
                                            index={index + 1}
                                        />
                                    ))}
                                </motion.div>
                            </TabsContent>

                            <TabsContent value="sources">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex overflow-x-auto gap-2 pb-2 no-scrollbar snap-x"
                                >
                                    {sources.map((source) => (
                                        <SourceCard
                                            key={`source-${source.id}`}
                                            source={source}
                                            record={sourceRecords[source.extra_info.id]}
                                            isLoading={isLoading}
                                        />
                                    ))}
                                </motion.div>
                            </TabsContent>
                        </div>
                    )}
                </Tabs>
            </div>
        </div>
    );
}

// New component for citation cards
function CitationCard({ citation, index }: { citation: string; index: number }) {
    const domain = extractDomain(citation);
    const faviconUrl = getFaviconUrl(domain);

    // Truncate URL for display
    const displayUrl = domain.length > 25
        ? domain.substring(0, 22) + '...'
        : domain;

    return (
        <div className="flex flex-col rounded-none bg-background/30 hover:bg-background/50 transition-colors border border-border/30 min-w-[200px] w-[200px] overflow-hidden flex-shrink-0 snap-start">
            {/* Header with index number, favicon and domain */}
            <div className="flex items-center p-1 border-b border-border/20">
                <div className="flex items-center justify-center min-w-5 h-5 mr-2 rounded-sm bg-[#B1E116]/10 text-xs text-white/80">
                    {index}
                </div>

                <div className="relative h-6 w-6 rounded-sm overflow-hidden mr-1 flex-shrink-0 bg-background/50 flex items-center justify-center">
                    <Image
                        src={faviconUrl}
                        alt={domain}
                        width={16}
                        height={16}
                        className="object-contain"
                    />
                </div>

                <div className="flex-grow min-w-0">
                    <div className="text-sm font-medium text-white/90 truncate">
                        {displayUrl}
                    </div>
                </div>

                <Link
                    href={citation}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <div className="flex items-center justify-center w-6 h-6 rounded-none hover:bg-white/10 transition-colors border-white/20">
                        <ArrowRight className="h-4 w-4 text-white/50" />
                    </div>
                </Link>
            </div>

            {/* Link display area */}
            <div className="p-1.5">
                <div className="flex flex-wrap gap-1.5 p-0">
                    <div className="flex items-center text-xs text-white/60">
                        <LinkIcon className="h-3 w-3 mr-1" />
                        <Link
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-white/80 line-clamp-1 transition-colors"
                        >
                            {citation.length > 40 ? citation.substring(0, 37) + '...' : citation}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SourceCard({ source, record, isLoading }: {
    source: Source;
    record?: SourceRecord;
    isLoading: boolean;
}) {
    const { type, id, url, image_url: sourceImageUrl, name, domain } = source.extra_info;

    // Use record data if available, otherwise fall back to source data
    const displayName = record?.name || name || (domain ? domain.replace(/^www\./, '') : "Untitled Source");
    const imageUrl = record?.image_url || sourceImageUrl;
    const description = record?.description || record?.intent_summary || source.text;
    const createdAt = record?.created_at ? new Date(record.created_at) : null;
    const keywords = record?.keywords || [];
    const buyingStage = record?.buying_stage;

    // Format date if available
    const formattedDate = createdAt ?
        createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) :
        null;

    // Determine source type display name
    function getSourceType() {
        switch (type) {
            case 'ad':
                return 'Advertisement';
            case 'market_research':
                return 'Market Research';
            case 'citation':
                return 'Citation';
            default:
                return type.charAt(0).toUpperCase() + type.slice(1);
        }
    }

    // Determine the link to use
    const linkHref = url ||
        (type === "ad" ? `/library/${id}` :
            (type === "market_research" || type === "citation") ? `/market/${id}` : '#');

    return (
        <div className="flex flex-col rounded-none bg-background/30 hover:bg-background/50 transition-colors border border-border/30 min-w-[200px] w-[200px] overflow-hidden flex-shrink-0 snap-start">
            {/* Header without index number */}
            <div className="flex items-center p-1 border-b border-border/20">
                <div className="relative h-6 w-6 rounded-sm overflow-hidden mr-3 flex-shrink-0 bg-background/50 flex items-center justify-center">
                    {imageUrl ? (
                        <Image
                            src={imageUrl}
                            alt={displayName}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <SourceIcon type={type} />
                    )}
                </div>

                <div className="flex-grow min-w-0">
                    <div className="text-sm font-medium text-white/90 truncate">
                        {displayName}
                    </div>
                    {domain && (
                        <div className="text-xs text-white/50 truncate">
                            {domain.replace(/^www\./, '')}
                        </div>
                    )}
                </div>

                <Link
                    href={linkHref}
                    target={url ? "_blank" : "_self"}
                    rel={url ? "noopener noreferrer" : ""}
                >
                    <div className="flex items-center justify-center w-6 h-6 rounded-none hover:bg-white/10 transition-colors border-white/20">
                        <ArrowRight className="h-4 w-4 text-white/50" />
                    </div>
                </Link>
            </div>

            {/* Content area */}
            <div className="p-1.5">
                {isLoading ? (
                    <div className="animate-pulse h-16 bg-background/40 rounded"></div>
                ) : (
                    <>
                        {/* Metadata section */}
                        <div className="flex flex-wrap gap-1.5 p-0">
                            {buyingStage && (
                                <div className="flex items-center text-xs text-white/60">
                                    <Info className="h-3 w-3 mr-1" />
                                    {buyingStage}
                                </div>
                            )}

                            {Array.isArray(keywords) && keywords.length > 0 && (
                                <div className="flex items-center text-xs text-white/60">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {typeof keywords[0] === 'string'
                                        ? keywords[0]
                                        : keywords[0]?.keyword || keywords[0]?.term || ''}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function SourceIcon({ type }: { type: string }) {
    switch (type) {
        case 'ad':
            return <ImageIcon className="h-4 w-4 text-blue-400" />;
        case 'market_research':
            return <FileText className="h-4 w-4 text-green-400" />;
        case 'citation':
            return <ExternalLink className="h-4 w-4 text-purple-400" />;
        default:
            return <Globe className="h-4 w-4 text-gray-400" />;
    }
} 