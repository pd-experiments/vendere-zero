export type LibraryItem = {
    id: string;
    type: 'image' | 'video';
    image_url?: string;
    name?: string | null;
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
    similarity?: number;
};

export type SearchResponse = {
    results: LibraryItem[];
    analysis: string;
    query: string;
}; 