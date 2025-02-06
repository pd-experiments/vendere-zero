import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '10');
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;

        const supabase = createServerSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parallel requests for count and data
        const [countResult, dataResult] = await Promise.all([
            supabase
                .from('citation_research')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id),
            
            supabase
                .from('citation_research')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(start, end)
        ]);

        if (countResult.error) {
            console.error("Count error:", countResult.error);
            return NextResponse.json({ error: "Error counting items" }, { status: 500 });
        }

        if (dataResult.error) {
            console.error("Data error:", dataResult.error);
            return NextResponse.json({ error: "Error fetching research data" }, { status: 500 });
        }

        const transformedItems = dataResult.data.map(item => ({
            id: item.id,
            imageUrl: item.image_url,
            siteUrl: item.site_url,
            intentSummary: item.intent_summary,
            primaryIntent: item.primary_intent,
            secondaryIntents: item.secondary_intents,
            buyingStage: item.buying_stage,
            competitorBrands: item.competitor_brands,
            keyFeatures: item.key_features,
            keywords: item.keywords,
            marketSegments: item.market_segments,
            pricePoints: item.price_points,
            seasonalFactors: item.seasonal_factors,
            created_at: item.created_at || new Date().toISOString()
        }));

        return NextResponse.json({
            items: transformedItems,
            total: countResult.count,
            page,
            pageSize,
            totalPages: Math.ceil((countResult.count || 0) / pageSize)
        });

    } catch (error) {
        console.error("Error fetching citation research data:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
