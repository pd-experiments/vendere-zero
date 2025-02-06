create table "public"."market_research" (
    "id" uuid not null default gen_random_uuid(),
    "advertisement_url" text not null,
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


alter table "public"."google_image_ads" add column "ad_description" text;

CREATE UNIQUE INDEX market_research_pkey ON public.market_research USING btree (id);

alter table "public"."market_research" add constraint "market_research_pkey" PRIMARY KEY using index "market_research_pkey";

alter table "public"."market_research" add constraint "fk_advertisement_url" FOREIGN KEY (advertisement_url) REFERENCES google_image_ads(advertisement_url) ON DELETE CASCADE not valid;

alter table "public"."market_research" validate constraint "fk_advertisement_url";

grant delete on table "public"."market_research" to "anon";

grant insert on table "public"."market_research" to "anon";

grant references on table "public"."market_research" to "anon";

grant select on table "public"."market_research" to "anon";

grant trigger on table "public"."market_research" to "anon";

grant truncate on table "public"."market_research" to "anon";

grant update on table "public"."market_research" to "anon";

grant delete on table "public"."market_research" to "authenticated";

grant insert on table "public"."market_research" to "authenticated";

grant references on table "public"."market_research" to "authenticated";

grant select on table "public"."market_research" to "authenticated";

grant trigger on table "public"."market_research" to "authenticated";

grant truncate on table "public"."market_research" to "authenticated";

grant update on table "public"."market_research" to "authenticated";

grant delete on table "public"."market_research" to "service_role";

grant insert on table "public"."market_research" to "service_role";

grant references on table "public"."market_research" to "service_role";

grant select on table "public"."market_research" to "service_role";

grant trigger on table "public"."market_research" to "service_role";

grant truncate on table "public"."market_research" to "service_role";

grant update on table "public"."market_research" to "service_role";


