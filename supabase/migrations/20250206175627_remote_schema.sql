alter table "public"."market_research" drop constraint "fk_advertisement_url";

create table "public"."market_research_v2" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "image_url" text not null,
    "created_at" timestamp with time zone not null default now(),
    "intent_summary" text not null,
    "target_audience" jsonb not null,
    "pain_points" jsonb not null,
    "buying_stage" text not null,
    "key_features" jsonb not null,
    "competitive_advantages" jsonb not null,
    "perplexity_insights" text not null,
    "citations" text[] not null
);


alter table "public"."market_research" drop column "advertisement_url";

alter table "public"."market_research" add column "image_url" text not null;

alter table "public"."market_research" add column "site_url" text not null;

CREATE INDEX idx_market_research_v2_created_at ON public.market_research_v2 USING btree (created_at);

CREATE INDEX idx_market_research_v2_image_url ON public.market_research_v2 USING btree (image_url);

CREATE UNIQUE INDEX market_research_v2_pkey ON public.market_research_v2 USING btree (id);

alter table "public"."market_research_v2" add constraint "market_research_v2_pkey" PRIMARY KEY using index "market_research_v2_pkey";

alter table "public"."market_research_v2" add constraint "ad_structured_output_user_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."market_research_v2" validate constraint "ad_structured_output_user_fkey";

grant delete on table "public"."market_research_v2" to "anon";

grant insert on table "public"."market_research_v2" to "anon";

grant references on table "public"."market_research_v2" to "anon";

grant select on table "public"."market_research_v2" to "anon";

grant trigger on table "public"."market_research_v2" to "anon";

grant truncate on table "public"."market_research_v2" to "anon";

grant update on table "public"."market_research_v2" to "anon";

grant delete on table "public"."market_research_v2" to "authenticated";

grant insert on table "public"."market_research_v2" to "authenticated";

grant references on table "public"."market_research_v2" to "authenticated";

grant select on table "public"."market_research_v2" to "authenticated";

grant trigger on table "public"."market_research_v2" to "authenticated";

grant truncate on table "public"."market_research_v2" to "authenticated";

grant update on table "public"."market_research_v2" to "authenticated";

grant delete on table "public"."market_research_v2" to "service_role";

grant insert on table "public"."market_research_v2" to "service_role";

grant references on table "public"."market_research_v2" to "service_role";

grant select on table "public"."market_research_v2" to "service_role";

grant trigger on table "public"."market_research_v2" to "service_role";

grant truncate on table "public"."market_research_v2" to "service_role";

grant update on table "public"."market_research_v2" to "service_role";


