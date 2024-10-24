import { NextRequest, NextResponse } from "next/server";
import { MatchAdsResponse } from "./schemas";
import { supabase } from "@/lib/supabase";
import { openai } from "@/lib/ai";

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

    console.log(data);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
