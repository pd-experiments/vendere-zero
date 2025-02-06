revoke delete on table "public"."market_research" from "anon";

revoke insert on table "public"."market_research" from "anon";

revoke references on table "public"."market_research" from "anon";

revoke select on table "public"."market_research" from "anon";

revoke trigger on table "public"."market_research" from "anon";

revoke truncate on table "public"."market_research" from "anon";

revoke update on table "public"."market_research" from "anon";

revoke delete on table "public"."market_research" from "authenticated";

revoke insert on table "public"."market_research" from "authenticated";

revoke references on table "public"."market_research" from "authenticated";

revoke select on table "public"."market_research" from "authenticated";

revoke trigger on table "public"."market_research" from "authenticated";

revoke truncate on table "public"."market_research" from "authenticated";

revoke update on table "public"."market_research" from "authenticated";

revoke delete on table "public"."market_research" from "service_role";

revoke insert on table "public"."market_research" from "service_role";

revoke references on table "public"."market_research" from "service_role";

revoke select on table "public"."market_research" from "service_role";

revoke trigger on table "public"."market_research" from "service_role";

revoke truncate on table "public"."market_research" from "service_role";

revoke update on table "public"."market_research" from "service_role";

alter table "public"."market_research" drop constraint "market_research_pkey";

drop index if exists "public"."market_research_pkey";

drop table "public"."market_research";

create table "public"."citation_research" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "image_url" text not null,
    "site_url" text not null,
    "intent_summary" text not null,
    "primary_intent" text not null,
    "secondary_intents" text[] not null,
    "market_segments" jsonb not null,
    "key_features" jsonb not null,
    "price_points" jsonb not null,
    "buying_stage" text not null,
    "seasonal_factors" text[],
    "competitor_brands" text[] not null,
    "keywords" text[] not null,
    "created_at" timestamp with time zone default now()
);


CREATE UNIQUE INDEX citation_research_pkey ON public.citation_research USING btree (id);

alter table "public"."citation_research" add constraint "citation_research_pkey" PRIMARY KEY using index "citation_research_pkey";

alter table "public"."citation_research" add constraint "ad_structured_output_user_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."citation_research" validate constraint "ad_structured_output_user_fkey";

grant delete on table "public"."citation_research" to "anon";

grant insert on table "public"."citation_research" to "anon";

grant references on table "public"."citation_research" to "anon";

grant select on table "public"."citation_research" to "anon";

grant trigger on table "public"."citation_research" to "anon";

grant truncate on table "public"."citation_research" to "anon";

grant update on table "public"."citation_research" to "anon";

grant delete on table "public"."citation_research" to "authenticated";

grant insert on table "public"."citation_research" to "authenticated";

grant references on table "public"."citation_research" to "authenticated";

grant select on table "public"."citation_research" to "authenticated";

grant trigger on table "public"."citation_research" to "authenticated";

grant truncate on table "public"."citation_research" to "authenticated";

grant update on table "public"."citation_research" to "authenticated";

grant delete on table "public"."citation_research" to "service_role";

grant insert on table "public"."citation_research" to "service_role";

grant references on table "public"."citation_research" to "service_role";

grant select on table "public"."citation_research" to "service_role";

grant trigger on table "public"."citation_research" to "service_role";

grant truncate on table "public"."citation_research" to "service_role";

grant update on table "public"."citation_research" to "service_role";


