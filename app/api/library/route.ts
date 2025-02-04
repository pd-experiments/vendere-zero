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

        // Use parallel requests for count and data
        const [countResult, dataResult] = await Promise.all([
            supabase
                .from('library_items')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id),
            
            supabase
                .from('library_items')
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
            return NextResponse.json({ error: "Error fetching library items" }, { status: 500 });
        }

        const transformedItems = dataResult.data.map(item => ({
            id: item.id,
            type: item.type,
            name: item.name,
            image_url: item.preview_url,
            video: item.type === 'video' ? {
                id: item.item_id,
                name: item.name,
                description: item.description,
            } : undefined,
            image_description: item.description || 'No description',
            features: item.features || [],
            sentiment_analysis: {
                tones: item.sentiment_tones || [],
                confidence: item.avg_sentiment_confidence || 0
            },
            created_at: item.created_at
        }));

        return NextResponse.json({
            items: transformedItems,
            total: countResult.count,
            page,
            pageSize,
            totalPages: Math.ceil((countResult.count || 0) / pageSize)
        });
    } catch (error) {
        console.error("Error fetching library data:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}