import { NextRequest, NextResponse } from "next/server";
import { getOrganicResults, getPaidResults } from "./semrush";

export async function POST(request: NextRequest) {
    const { query } = await request.json();

    if (!query) {
        return NextResponse.json({ error: "Query is required" }, {
            status: 400,
        });
    }

    const organicResults = await getOrganicResults(query);
    const paidResults = await getPaidResults(query);

    return NextResponse.json({ organicResults, paidResults });
}
