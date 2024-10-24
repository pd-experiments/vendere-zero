create extension if not exists "vector" with schema "extensions";


alter table "public"."ad_structured_output" add column "description_embeddings" vector;


