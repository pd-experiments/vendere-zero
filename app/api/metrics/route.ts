import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { AdVisualWithMetric } from "./schemas";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    console.log(searchParams);
    const offset = searchParams.get("offset");
    const count = parseInt(searchParams.get("count") || "1000", 10);

    const from = offset ? parseInt(offset, 10) : 0;

    const { data, error } = await supabase
        .from("ad_structured_output")
        .select(
            "id, image_description, image_url, features(keyword, confidence_score, category, location, visual_attributes(attribute, value)), ad_metrics(clicks, impressions, ctr)",
        )
        .range(from, from + count - 1)
        .returns<AdVisualWithMetric[]>();
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
