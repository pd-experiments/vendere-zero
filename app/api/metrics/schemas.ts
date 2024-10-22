type AdVisualWithMetric = {
    id: string;
    image_description: string;
    image_url: string;

    features: {
        keyword: string;
        confidence_score: number;
        category: string;
        location: string;
        visual_attributes: {
            attribute: string;
            value: string;
        }[];
    }[];

    ad_metrics: {
        clicks: number;
        impressions: number;
        ctr: number;
    }[];
};

export type { AdVisualWithMetric };
