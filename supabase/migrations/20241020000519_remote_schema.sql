create table "public"."ad_structured_output" (
    "id" uuid not null default gen_random_uuid(),
    "image_description" text not null
);


create table "public"."features" (
    "id" uuid not null default gen_random_uuid(),
    "ad_output_id" uuid not null,
    "keyword" text not null,
    "confidence_score" numeric(3,2) not null,
    "category" text not null,
    "location" text not null
);


create table "public"."sentiment_analysis" (
    "id" uuid not null default gen_random_uuid(),
    "ad_output_id" uuid not null,
    "tone" text not null,
    "confidence" numeric(3,2) not null
);


create table "public"."visual_attributes" (
    "id" uuid not null default gen_random_uuid(),
    "feature_id" uuid not null,
    "attribute" text not null,
    "value" text not null
);


CREATE UNIQUE INDEX ad_structured_output_pkey ON public.ad_structured_output USING btree (id);

CREATE UNIQUE INDEX features_pkey ON public.features USING btree (id);

CREATE UNIQUE INDEX sentiment_analysis_pkey ON public.sentiment_analysis USING btree (id);

CREATE UNIQUE INDEX visual_attributes_pkey ON public.visual_attributes USING btree (id);

alter table "public"."ad_structured_output" add constraint "ad_structured_output_pkey" PRIMARY KEY using index "ad_structured_output_pkey";

alter table "public"."features" add constraint "features_pkey" PRIMARY KEY using index "features_pkey";

alter table "public"."sentiment_analysis" add constraint "sentiment_analysis_pkey" PRIMARY KEY using index "sentiment_analysis_pkey";

alter table "public"."visual_attributes" add constraint "visual_attributes_pkey" PRIMARY KEY using index "visual_attributes_pkey";

alter table "public"."features" add constraint "features_ad_output_id_fkey" FOREIGN KEY (ad_output_id) REFERENCES ad_structured_output(id) ON DELETE CASCADE not valid;

alter table "public"."features" validate constraint "features_ad_output_id_fkey";

alter table "public"."features" add constraint "features_confidence_score_check" CHECK (((confidence_score >= 0.0) AND (confidence_score <= 1.0))) not valid;

alter table "public"."features" validate constraint "features_confidence_score_check";

alter table "public"."features" add constraint "features_location_check" CHECK ((location = ANY (ARRAY['top-left'::text, 'top-center'::text, 'top-right'::text, 'middle-left'::text, 'middle-center'::text, 'middle-right'::text, 'bottom-left'::text, 'bottom-center'::text, 'bottom-right'::text, 'unknown'::text]))) not valid;

alter table "public"."features" validate constraint "features_location_check";

alter table "public"."sentiment_analysis" add constraint "sentiment_analysis_ad_output_id_fkey" FOREIGN KEY (ad_output_id) REFERENCES ad_structured_output(id) ON DELETE CASCADE not valid;

alter table "public"."sentiment_analysis" validate constraint "sentiment_analysis_ad_output_id_fkey";

alter table "public"."sentiment_analysis" add constraint "sentiment_analysis_confidence_check" CHECK (((confidence >= 0.0) AND (confidence <= 1.0))) not valid;

alter table "public"."sentiment_analysis" validate constraint "sentiment_analysis_confidence_check";

alter table "public"."visual_attributes" add constraint "visual_attributes_feature_id_fkey" FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE not valid;

alter table "public"."visual_attributes" validate constraint "visual_attributes_feature_id_fkey";

grant delete on table "public"."ad_structured_output" to "anon";

grant insert on table "public"."ad_structured_output" to "anon";

grant references on table "public"."ad_structured_output" to "anon";

grant select on table "public"."ad_structured_output" to "anon";

grant trigger on table "public"."ad_structured_output" to "anon";

grant truncate on table "public"."ad_structured_output" to "anon";

grant update on table "public"."ad_structured_output" to "anon";

grant delete on table "public"."ad_structured_output" to "authenticated";

grant insert on table "public"."ad_structured_output" to "authenticated";

grant references on table "public"."ad_structured_output" to "authenticated";

grant select on table "public"."ad_structured_output" to "authenticated";

grant trigger on table "public"."ad_structured_output" to "authenticated";

grant truncate on table "public"."ad_structured_output" to "authenticated";

grant update on table "public"."ad_structured_output" to "authenticated";

grant delete on table "public"."ad_structured_output" to "service_role";

grant insert on table "public"."ad_structured_output" to "service_role";

grant references on table "public"."ad_structured_output" to "service_role";

grant select on table "public"."ad_structured_output" to "service_role";

grant trigger on table "public"."ad_structured_output" to "service_role";

grant truncate on table "public"."ad_structured_output" to "service_role";

grant update on table "public"."ad_structured_output" to "service_role";

grant delete on table "public"."features" to "anon";

grant insert on table "public"."features" to "anon";

grant references on table "public"."features" to "anon";

grant select on table "public"."features" to "anon";

grant trigger on table "public"."features" to "anon";

grant truncate on table "public"."features" to "anon";

grant update on table "public"."features" to "anon";

grant delete on table "public"."features" to "authenticated";

grant insert on table "public"."features" to "authenticated";

grant references on table "public"."features" to "authenticated";

grant select on table "public"."features" to "authenticated";

grant trigger on table "public"."features" to "authenticated";

grant truncate on table "public"."features" to "authenticated";

grant update on table "public"."features" to "authenticated";

grant delete on table "public"."features" to "service_role";

grant insert on table "public"."features" to "service_role";

grant references on table "public"."features" to "service_role";

grant select on table "public"."features" to "service_role";

grant trigger on table "public"."features" to "service_role";

grant truncate on table "public"."features" to "service_role";

grant update on table "public"."features" to "service_role";

grant delete on table "public"."sentiment_analysis" to "anon";

grant insert on table "public"."sentiment_analysis" to "anon";

grant references on table "public"."sentiment_analysis" to "anon";

grant select on table "public"."sentiment_analysis" to "anon";

grant trigger on table "public"."sentiment_analysis" to "anon";

grant truncate on table "public"."sentiment_analysis" to "anon";

grant update on table "public"."sentiment_analysis" to "anon";

grant delete on table "public"."sentiment_analysis" to "authenticated";

grant insert on table "public"."sentiment_analysis" to "authenticated";

grant references on table "public"."sentiment_analysis" to "authenticated";

grant select on table "public"."sentiment_analysis" to "authenticated";

grant trigger on table "public"."sentiment_analysis" to "authenticated";

grant truncate on table "public"."sentiment_analysis" to "authenticated";

grant update on table "public"."sentiment_analysis" to "authenticated";

grant delete on table "public"."sentiment_analysis" to "service_role";

grant insert on table "public"."sentiment_analysis" to "service_role";

grant references on table "public"."sentiment_analysis" to "service_role";

grant select on table "public"."sentiment_analysis" to "service_role";

grant trigger on table "public"."sentiment_analysis" to "service_role";

grant truncate on table "public"."sentiment_analysis" to "service_role";

grant update on table "public"."sentiment_analysis" to "service_role";

grant delete on table "public"."visual_attributes" to "anon";

grant insert on table "public"."visual_attributes" to "anon";

grant references on table "public"."visual_attributes" to "anon";

grant select on table "public"."visual_attributes" to "anon";

grant trigger on table "public"."visual_attributes" to "anon";

grant truncate on table "public"."visual_attributes" to "anon";

grant update on table "public"."visual_attributes" to "anon";

grant delete on table "public"."visual_attributes" to "authenticated";

grant insert on table "public"."visual_attributes" to "authenticated";

grant references on table "public"."visual_attributes" to "authenticated";

grant select on table "public"."visual_attributes" to "authenticated";

grant trigger on table "public"."visual_attributes" to "authenticated";

grant truncate on table "public"."visual_attributes" to "authenticated";

grant update on table "public"."visual_attributes" to "authenticated";

grant delete on table "public"."visual_attributes" to "service_role";

grant insert on table "public"."visual_attributes" to "service_role";

grant references on table "public"."visual_attributes" to "service_role";

grant select on table "public"."visual_attributes" to "service_role";

grant trigger on table "public"."visual_attributes" to "service_role";

grant truncate on table "public"."visual_attributes" to "service_role";

grant update on table "public"."visual_attributes" to "service_role";


