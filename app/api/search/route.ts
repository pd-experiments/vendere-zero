import { NextRequest, NextResponse } from "next/server";
import { MatchAdsResponse } from "./schemas";
import { supabase } from "@/lib/supabase";
import { openai } from "@/lib/ai";
import { AdVisualWithMetric } from "../metrics/schemas";

export async function POST(request: NextRequest) {
    const { query }: { query: string } = await request.json();

    const embedding = await openai.embeddings.create({
        input: query,
        model: "text-embedding-3-small",
    });
    const embedding_vector = embedding.data[0].embedding;

    console.log(embedding_vector.slice(0, 10));

    const { data, error } = await supabase.rpc("match_ads", {
        query_embedding: embedding_vector,
        match_threshold: 0.5,
        match_count: 10,
    })
        .returns<MatchAdsResponse[]>();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = data.map((ad) => ad.id);

    const { data: allData, error: aggError } = await supabase
        .from("ad_structured_output")
        .select(
            "id, image_description, image_url, features(keyword, confidence_score, category, location, visual_attributes(attribute, value)), ad_metrics(clicks, impressions, ctr)",
        )
        .in("id", ids)
        .returns<AdVisualWithMetric[]>();

    if (aggError) {
        return NextResponse.json({ error: aggError.message }, { status: 500 });
    }

    return NextResponse.json(allData);
}
