-- Create the RPC function that can be called via the API
CREATE OR REPLACE FUNCTION add_item_id_column_to_keyword_variants()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  -- Check if the column already exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'keyword_variants' 
    AND column_name = 'item_id'
  ) INTO column_exists;
  
  -- Only add the column if it doesn't exist
  IF NOT column_exists THEN
    -- Add the item_id column as UUID
    ALTER TABLE keyword_variants ADD COLUMN item_id UUID;
    
    -- Add foreign key constraint if market_research table exists
    IF EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_name = 'market_research'
    ) THEN
      ALTER TABLE keyword_variants 
      ADD CONSTRAINT fk_keyword_variants_item_id 
      FOREIGN KEY (item_id) 
      REFERENCES market_research(id) 
      ON DELETE SET NULL;
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Added item_id column to keyword_variants table');
  ELSE
    RETURN json_build_object('success', true, 'message', 'item_id column already exists');
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$; 