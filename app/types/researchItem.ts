// Define the type for a keyword variant
export interface KeywordVariant {
    variant_id: string;
    keyword: string;
    source: string;
    search_volume: number;
    cpc: number;
    keyword_difficulty: number;
    competition_percentage: number;
    efficiency_index: number;
    confidence_score: number;
    explanation?: string;
    image_url: string;
    user_id: string;
    created_at?: string;
    [key: string]: unknown;
}

// Define the type for research items
export interface ResearchItem {
    id: string;
    title: string;
    description: string | null;
    keyword: string | null;
    keywords: string[];
    intent_summary: string | null;
    created_at: string | undefined;
    user_id: string;
    image_url: string | null;
    mr_image_url?: string | null;
    li_preview_url?: string | null;
    source: string;
    variant_count: number;

    // UI state properties
    expanded?: boolean;
    isLoadingVariants?: boolean;
    isGeneratingVariants?: boolean;
    variants: KeywordVariant[];

    // Legacy fields for backward compatibility
    li_name?: string;
    li_description?: string;
    mr_intent_summary?: string;
    mr_keywords?: string[];
    mr_buying_stage?: string;
    mr_target_audience?: Record<string, unknown>;
    mr_pain_points?: Record<string, unknown>;
}
