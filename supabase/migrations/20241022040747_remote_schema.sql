create table "public"."ad_metrics" (
    "id" uuid not null default gen_random_uuid(),
    "ad_id" uuid not null,
    "impressions" bigint not null default 0,
    "clicks" bigint not null default 0,
    "ctr" numeric(5,4) generated always as (((clicks)::numeric / (NULLIF(impressions, 0))::numeric)) stored
);


create table "public"."google_image_ads" (
    "advertisement_url" text not null,
    "advertiser_name" text,
    "advertiser_url" text,
    "image_url" text,
    "last_shown" date,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone default CURRENT_TIMESTAMP
);


CREATE UNIQUE INDEX ad_metrics_pkey ON public.ad_metrics USING btree (id);

CREATE UNIQUE INDEX google_image_ads_pkey ON public.google_image_ads USING btree (advertisement_url);

alter table "public"."ad_metrics" add constraint "ad_metrics_pkey" PRIMARY KEY using index "ad_metrics_pkey";

alter table "public"."google_image_ads" add constraint "google_image_ads_pkey" PRIMARY KEY using index "google_image_ads_pkey";

alter table "public"."ad_metrics" add constraint "ad_metrics_ad_id_fkey" FOREIGN KEY (ad_id) REFERENCES ad_structured_output(id) ON DELETE CASCADE not valid;

alter table "public"."ad_metrics" validate constraint "ad_metrics_ad_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."ad_metrics" to "anon";

grant insert on table "public"."ad_metrics" to "anon";

grant references on table "public"."ad_metrics" to "anon";

grant select on table "public"."ad_metrics" to "anon";

grant trigger on table "public"."ad_metrics" to "anon";

grant truncate on table "public"."ad_metrics" to "anon";

grant update on table "public"."ad_metrics" to "anon";

grant delete on table "public"."ad_metrics" to "authenticated";

grant insert on table "public"."ad_metrics" to "authenticated";

grant references on table "public"."ad_metrics" to "authenticated";

grant select on table "public"."ad_metrics" to "authenticated";

grant trigger on table "public"."ad_metrics" to "authenticated";

grant truncate on table "public"."ad_metrics" to "authenticated";

grant update on table "public"."ad_metrics" to "authenticated";

grant delete on table "public"."ad_metrics" to "service_role";

grant insert on table "public"."ad_metrics" to "service_role";

grant references on table "public"."ad_metrics" to "service_role";

grant select on table "public"."ad_metrics" to "service_role";

grant trigger on table "public"."ad_metrics" to "service_role";

grant truncate on table "public"."ad_metrics" to "service_role";

grant update on table "public"."ad_metrics" to "service_role";

grant delete on table "public"."google_image_ads" to "anon";

grant insert on table "public"."google_image_ads" to "anon";

grant references on table "public"."google_image_ads" to "anon";

grant select on table "public"."google_image_ads" to "anon";

grant trigger on table "public"."google_image_ads" to "anon";

grant truncate on table "public"."google_image_ads" to "anon";

grant update on table "public"."google_image_ads" to "anon";

grant delete on table "public"."google_image_ads" to "authenticated";

grant insert on table "public"."google_image_ads" to "authenticated";

grant references on table "public"."google_image_ads" to "authenticated";

grant select on table "public"."google_image_ads" to "authenticated";

grant trigger on table "public"."google_image_ads" to "authenticated";

grant truncate on table "public"."google_image_ads" to "authenticated";

grant update on table "public"."google_image_ads" to "authenticated";

grant delete on table "public"."google_image_ads" to "service_role";

grant insert on table "public"."google_image_ads" to "service_role";

grant references on table "public"."google_image_ads" to "service_role";

grant select on table "public"."google_image_ads" to "service_role";

grant trigger on table "public"."google_image_ads" to "service_role";

grant truncate on table "public"."google_image_ads" to "service_role";

grant update on table "public"."google_image_ads" to "service_role";

CREATE TRIGGER trigger_update_updated_at BEFORE UPDATE ON public.google_image_ads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


