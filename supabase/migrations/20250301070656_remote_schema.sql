drop function if exists "public"."add_item_id_column_to_keyword_variants"();

create table "public"."keyword_variants" (
    "id" uuid not null default gen_random_uuid(),
    "variant_id" text not null,
    "keyword" text not null,
    "image_url" text,
    "search_volume" integer not null,
    "cpc" numeric(10,2) not null,
    "keyword_difficulty" numeric(5,2) not null,
    "competition_percentage" numeric(5,4) not null,
    "efficiency_index" numeric(5,2) not null,
    "confidence_score" numeric(5,4) not null,
    "source" text not null,
    "explanation" text not null,
    "geo_target" text,
    "audience_segment" text,
    "predicted_performance" numeric(5,4),
    "created_at" timestamp with time zone default now(),
    "user_id" uuid
);


create table "public"."semrush_keywords" (
    "id" uuid not null default gen_random_uuid(),
    "keyword" text not null,
    "position" integer,
    "previous_position" integer,
    "search_volume" integer,
    "keyword_difficulty" integer,
    "cpc" numeric(10,2),
    "url" text,
    "traffic" integer,
    "traffic_percentage" numeric(10,2),
    "traffic_cost" numeric(10,2),
    "competition" numeric(10,2),
    "number_of_results" bigint,
    "trends" integer[],
    "timestamp" date,
    "serp_features" text[],
    "keyword_intents" text[],
    "position_type" text
);


alter table "public"."markets_overview" disable row level security;

CREATE INDEX idx_keyword_variants_keyword ON public.keyword_variants USING btree (keyword);

CREATE INDEX idx_keyword_variants_source ON public.keyword_variants USING btree (source);

CREATE INDEX idx_keyword_variants_user_id ON public.keyword_variants USING btree (user_id);

CREATE UNIQUE INDEX keyword_variants_pkey ON public.keyword_variants USING btree (id);

CREATE UNIQUE INDEX semrush_keywords_pkey ON public.semrush_keywords USING btree (id);

CREATE UNIQUE INDEX unique_variant_keyword ON public.keyword_variants USING btree (variant_id, keyword);

alter table "public"."keyword_variants" add constraint "keyword_variants_pkey" PRIMARY KEY using index "keyword_variants_pkey";

alter table "public"."semrush_keywords" add constraint "semrush_keywords_pkey" PRIMARY KEY using index "semrush_keywords_pkey";

alter table "public"."keyword_variants" add constraint "keyword_variants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."keyword_variants" validate constraint "keyword_variants_user_id_fkey";

alter table "public"."keyword_variants" add constraint "unique_variant_keyword" UNIQUE using index "unique_variant_keyword";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.join_market_research_and_library_items()
 RETURNS TABLE(mr_id uuid, mr_user_id uuid, mr_image_url text, mr_created_at timestamp with time zone, mr_intent_summary text, mr_target_audience jsonb, mr_pain_points jsonb, mr_buying_stage text, mr_key_features jsonb, mr_competitive_advantages jsonb, mr_perplexity_insights text, mr_citations text[], mr_keywords jsonb[], mr_original_headlines jsonb[], mr_new_headlines jsonb[], li_id uuid, li_type library_item_type, li_name text, li_description text, li_user_id uuid, li_created_at timestamp with time zone, li_item_id uuid, li_features text[], li_sentiment_tones text[], li_avg_sentiment_confidence numeric, li_preview_url text)
 LANGUAGE sql
AS $function$
  SELECT
    -- market_research_v2 columns (prefixed with mr_)
    mr.id                   AS mr_id,
    mr.user_id              AS mr_user_id,
    mr.image_url            AS mr_image_url,
    mr.created_at           AS mr_created_at,
    mr.intent_summary       AS mr_intent_summary,
    mr.target_audience      AS mr_target_audience,
    mr.pain_points          AS mr_pain_points,
    mr.buying_stage         AS mr_buying_stage,
    mr.key_features         AS mr_key_features,
    mr.competitive_advantages AS mr_competitive_advantages,
    mr.perplexity_insights  AS mr_perplexity_insights,
    mr.citations            AS mr_citations,
    mr.keywords             AS mr_keywords,
    mr.original_headlines   AS mr_original_headlines,
    mr.new_headlines        AS mr_new_headlines,

    -- library_items columns (prefixed with li_)
    li.id                   AS li_id,
    li.type                 AS li_type,
    li.name                 AS li_name,
    li.description          AS li_description,
    li.user_id              AS li_user_id,
    li.created_at           AS li_created_at,
    li.item_id              AS li_item_id,
    li.features             AS li_features,
    li.sentiment_tones      AS li_sentiment_tones,
    li.avg_sentiment_confidence AS li_avg_sentiment_confidence,
    li.preview_url          AS li_preview_url
  FROM public.market_research_v2 mr
  INNER JOIN public.library_items li
    ON mr.image_url = li.preview_url;
$function$
;

grant delete on table "public"."keyword_variants" to "anon";

grant insert on table "public"."keyword_variants" to "anon";

grant references on table "public"."keyword_variants" to "anon";

grant select on table "public"."keyword_variants" to "anon";

grant trigger on table "public"."keyword_variants" to "anon";

grant truncate on table "public"."keyword_variants" to "anon";

grant update on table "public"."keyword_variants" to "anon";

grant delete on table "public"."keyword_variants" to "authenticated";

grant insert on table "public"."keyword_variants" to "authenticated";

grant references on table "public"."keyword_variants" to "authenticated";

grant select on table "public"."keyword_variants" to "authenticated";

grant trigger on table "public"."keyword_variants" to "authenticated";

grant truncate on table "public"."keyword_variants" to "authenticated";

grant update on table "public"."keyword_variants" to "authenticated";

grant delete on table "public"."keyword_variants" to "service_role";

grant insert on table "public"."keyword_variants" to "service_role";

grant references on table "public"."keyword_variants" to "service_role";

grant select on table "public"."keyword_variants" to "service_role";

grant trigger on table "public"."keyword_variants" to "service_role";

grant truncate on table "public"."keyword_variants" to "service_role";

grant update on table "public"."keyword_variants" to "service_role";

grant delete on table "public"."semrush_keywords" to "anon";

grant insert on table "public"."semrush_keywords" to "anon";

grant references on table "public"."semrush_keywords" to "anon";

grant select on table "public"."semrush_keywords" to "anon";

grant trigger on table "public"."semrush_keywords" to "anon";

grant truncate on table "public"."semrush_keywords" to "anon";

grant update on table "public"."semrush_keywords" to "anon";

grant delete on table "public"."semrush_keywords" to "authenticated";

grant insert on table "public"."semrush_keywords" to "authenticated";

grant references on table "public"."semrush_keywords" to "authenticated";

grant select on table "public"."semrush_keywords" to "authenticated";

grant trigger on table "public"."semrush_keywords" to "authenticated";

grant truncate on table "public"."semrush_keywords" to "authenticated";

grant update on table "public"."semrush_keywords" to "authenticated";

grant delete on table "public"."semrush_keywords" to "service_role";

grant insert on table "public"."semrush_keywords" to "service_role";

grant references on table "public"."semrush_keywords" to "service_role";

grant select on table "public"."semrush_keywords" to "service_role";

grant trigger on table "public"."semrush_keywords" to "service_role";

grant truncate on table "public"."semrush_keywords" to "service_role";

grant update on table "public"."semrush_keywords" to "service_role";


create table "vecs"."ad_research" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


create table "vecs"."market_research_citations" (
    "id" character varying not null,
    "vec" vector(1536) not null,
    "metadata" jsonb not null default '{}'::jsonb
);


CREATE UNIQUE INDEX ad_research_pkey ON vecs.ad_research USING btree (id);

CREATE UNIQUE INDEX market_research_citations_pkey ON vecs.market_research_citations USING btree (id);

alter table "vecs"."ad_research" add constraint "ad_research_pkey" PRIMARY KEY using index "ad_research_pkey";

alter table "vecs"."market_research_citations" add constraint "market_research_citations_pkey" PRIMARY KEY using index "market_research_citations_pkey";


