CREATE OR REPLACE FUNCTION join_market_research_and_library_items(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  keyword TEXT,
  description TEXT,
  intent_summary TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  item_type TEXT
) AS $$
BEGIN
  RETURN QUERY 
    -- Get market research items
    SELECT
      mr.id,
      mr.title,
      mr.keyword,
      mr.description,
      mr.intent_summary,
      'market_research' AS source,
      mr.created_at,
      'market_research' AS item_type
    FROM market_research mr
    WHERE mr.user_id = user_id_param

    UNION ALL

    -- Get library items
    SELECT
      l.id,
      l.title,
      l.keyword,
      l.description,
      NULL AS intent_summary,
      'library' AS source,
      l.created_at,
      'library' AS item_type
    FROM library l
    WHERE l.user_id = user_id_param
    
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql; 