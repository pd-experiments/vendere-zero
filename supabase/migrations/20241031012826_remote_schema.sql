alter table "public"."ad_structured_output" add column "user" uuid;

alter table "public"."ad_structured_output" alter column "description_embeddings" set data type vector(1536) using "description_embeddings"::vector(1536);

alter table "public"."features" add column "user" uuid;

alter table "public"."sentiment_analysis" add column "user" uuid;

CREATE INDEX ad_structured_output_description_embeddings_idx ON public.ad_structured_output USING ivfflat (description_embeddings vector_cosine_ops) WITH (lists='100');

CREATE INDEX ad_structured_output_description_embeddings_idx1 ON public.ad_structured_output USING ivfflat (description_embeddings vector_cosine_ops) WITH (lists='100');

alter table "public"."ad_structured_output" add constraint "ad_structured_output_users_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."ad_structured_output" validate constraint "ad_structured_output_users_fkey";

alter table "public"."features" add constraint "features_users_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."features" validate constraint "features_users_fkey";

alter table "public"."sentiment_analysis" add constraint "sentiment_analysis_users_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."sentiment_analysis" validate constraint "sentiment_analysis_users_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_ads(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  -- Select the relevant ad fields and calculate similarity based on cosine similarity
  SELECT
    a.id,                              -- Return the id field
    1 - (a.description_embeddings <=> query_embedding) AS similarity  -- Calculate cosine similarity
  FROM ad_structured_output a
  -- Filter by similarity threshold, only return results with similarity >= threshold
  WHERE (1 - (a.description_embeddings <=> query_embedding)) >= match_threshold
  -- Order by highest cosine similarity first (descending)
  ORDER BY similarity DESC
  -- Limit the number of returned results to match_count
  LIMIT match_count;
$function$
;


