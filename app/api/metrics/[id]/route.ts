import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { AdVisualWithMetric } from "../schemas";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const id = params.id;

    const { data, error } = await supabase
        .from("ad_structured_output")
        .select(
            "id, image_description, image_url, features(keyword, confidence_score, category, location, visual_attributes(attribute, value)), ad_metrics(clicks, impressions, ctr)"
        )
        .eq("id", id)
        .returns<AdVisualWithMetric[]>()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(data);
} 