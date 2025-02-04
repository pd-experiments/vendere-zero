create type "public"."library_item_type" as enum ('image', 'video');

alter table "public"."ad_structured_output" drop constraint "ad_structured_output_users_fkey";

alter table "public"."features" drop constraint "features_users_fkey";

alter table "public"."sentiment_analysis" drop constraint "sentiment_analysis_users_fkey";

alter table "public"."videos" drop constraint "videos_user_id_fkey";

create table "public"."library_items" (
    "id" uuid not null default gen_random_uuid(),
    "type" library_item_type not null,
    "name" text,
    "description" text,
    "user_id" uuid,
    "created_at" timestamp with time zone default now(),
    "item_id" uuid
);


alter table "public"."library_items" enable row level security;

alter table "public"."ad_structured_output" enable row level security;

alter table "public"."features" enable row level security;

alter table "public"."sentiment_analysis" enable row level security;

alter table "public"."videos" enable row level security;

CREATE UNIQUE INDEX library_items_pkey ON public.library_items USING btree (id);

CREATE INDEX library_items_type_idx ON public.library_items USING btree (type);

CREATE UNIQUE INDEX library_items_unique_item ON public.library_items USING btree (item_id);

CREATE INDEX library_items_user_id_idx ON public.library_items USING btree (user_id);

alter table "public"."library_items" add constraint "library_items_pkey" PRIMARY KEY using index "library_items_pkey";

alter table "public"."ad_structured_output" add constraint "ad_structured_output_user_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ad_structured_output" validate constraint "ad_structured_output_user_fkey";

alter table "public"."features" add constraint "features_user_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."features" validate constraint "features_user_fkey";

alter table "public"."library_items" add constraint "library_items_unique_item" UNIQUE using index "library_items_unique_item";

alter table "public"."library_items" add constraint "library_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."library_items" validate constraint "library_items_user_id_fkey";

alter table "public"."library_items" add constraint "valid_item_reference" CHECK ((((type = 'video'::library_item_type) AND (item_id IS NOT NULL)) OR ((type = 'image'::library_item_type) AND (item_id IS NOT NULL)))) not valid;

alter table "public"."library_items" validate constraint "valid_item_reference";

alter table "public"."sentiment_analysis" add constraint "sentiment_analysis_user_fkey" FOREIGN KEY ("user") REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."sentiment_analysis" validate constraint "sentiment_analysis_user_fkey";

alter table "public"."videos" add constraint "videos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."videos" validate constraint "videos_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_library_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF TG_TABLE_NAME = 'videos' THEN
        INSERT INTO library_items (
            type,
            name,
            description,
            user_id,
            video_id
        ) VALUES (
            'video',
            NEW.name,
            NEW.description,
            NEW.user_id,  -- Ensure this matches the correct field
            NEW.id
        );
    ELSIF TG_TABLE_NAME = 'ad_structured_output' THEN
        INSERT INTO library_items (
            type,
            name,
            description,
            user_id,
            image_id
        ) VALUES (
            'image',
            NEW.name,
            NEW.image_description,
            NEW.user_id,  -- Ensure this matches the correct field
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fetch_library_items(user_id uuid)
 RETURNS TABLE(id uuid, type text, name text, image_url text, image_description text, features jsonb, sentiment_analysis jsonb, created_at timestamp without time zone)
 LANGUAGE plpgsql
AS $function$
begin
    return query
    select
        v.id,
        'video' as type,
        v.name,
        null as image_url,
        v.description as image_description,
        jsonb_agg(jsonb_build_object(
            'keyword', f.keyword,
            'confidence_score', f.confidence_score,
            'category', f.category,
            'location', f.location,
            'visual_attributes', f.visual_attributes
        )) as features,
        jsonb_build_object(
            'tones', array_agg(sa.tone),
            'confidence', avg(sa.confidence)
        ) as sentiment_analysis,
        v.created_at
    from
        videos v
    join
        video_frames_mapping vfm on v.id = vfm.video_id
    join
        ad_structured_output aso on vfm.frame_id = aso.id
    join
        features f on aso.id = f.ad_structured_output_id
    join
        sentiment_analysis sa on aso.id = sa.ad_structured_output_id
    where
        v.user_id = user_id
    group by
        v.id

    union all

    select
        aso.id,
        'image' as type,
        aso.name,
        aso.image_url,
        aso.image_description,
        jsonb_agg(jsonb_build_object(
            'keyword', f.keyword,
            'confidence_score', f.confidence_score,
            'category', f.category,
            'location', f.location,
            'visual_attributes', f.visual_attributes
        )) as features,
        jsonb_build_object(
            'tones', array_agg(sa.tone),
            'confidence', avg(sa.confidence)
        ) as sentiment_analysis,
        aso.created_at
    from
        ad_structured_output aso
    join
        features f on aso.id = f.ad_structured_output_id
    join
        sentiment_analysis sa on aso.id = sa.ad_structured_output_id
    where
        aso.user_id = user_id
    group by
        aso.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.match_ad_descriptions(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, name text, image_url text, image_description text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
  select
    aso.id,
    aso.name,
    aso.image_url,
    aso.image_description,
    1 - (aso.description_embeddings::vector(1536) <=> query_embedding) as similarity
  from ad_structured_output aso
  where 1 - (aso.description_embeddings::vector(1536) <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.match_ad_descriptions(query_embedding vector, match_threshold double precision, match_count integer, user_id uuid)
 RETURNS TABLE(id uuid, name text, image_url text, image_description text, similarity double precision)
 LANGUAGE plpgsql
AS $function$
begin
  return query
  select
    aso.id,
    aso.name,
    aso.image_url,
    aso.image_description,
    1 - (aso.description_embeddings::vector(1536) <=> query_embedding) as similarity
  from ad_structured_output aso
  where 1 - (aso.description_embeddings::vector(1536) <=> query_embedding) > match_threshold
    and aso.user = user_id
  order by similarity desc
  limit match_count;
end;
$function$
;

grant delete on table "public"."library_items" to "anon";

grant insert on table "public"."library_items" to "anon";

grant references on table "public"."library_items" to "anon";

grant select on table "public"."library_items" to "anon";

grant trigger on table "public"."library_items" to "anon";

grant truncate on table "public"."library_items" to "anon";

grant update on table "public"."library_items" to "anon";

grant delete on table "public"."library_items" to "authenticated";

grant insert on table "public"."library_items" to "authenticated";

grant references on table "public"."library_items" to "authenticated";

grant select on table "public"."library_items" to "authenticated";

grant trigger on table "public"."library_items" to "authenticated";

grant truncate on table "public"."library_items" to "authenticated";

grant update on table "public"."library_items" to "authenticated";

grant delete on table "public"."library_items" to "service_role";

grant insert on table "public"."library_items" to "service_role";

grant references on table "public"."library_items" to "service_role";

grant select on table "public"."library_items" to "service_role";

grant trigger on table "public"."library_items" to "service_role";

grant truncate on table "public"."library_items" to "service_role";

grant update on table "public"."library_items" to "service_role";

create policy "Users can insert their own ads"
on "public"."ad_structured_output"
as permissive
for insert
to authenticated
with check (("user" = auth.uid()));


create policy "Users can view their own ads"
on "public"."ad_structured_output"
as permissive
for select
to authenticated
using (("user" = auth.uid()));


create policy "Users can insert their own features"
on "public"."features"
as permissive
for insert
to authenticated
with check (("user" = auth.uid()));


create policy "Users can view their own features"
on "public"."features"
as permissive
for select
to authenticated
using (("user" = auth.uid()));


create policy "Users can delete their own library items"
on "public"."library_items"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own library items"
on "public"."library_items"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own library items"
on "public"."library_items"
as permissive
for update
to public
using ((auth.uid() = user_id));


create policy "Users can view their own library items"
on "public"."library_items"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own sentiment analysis"
on "public"."sentiment_analysis"
as permissive
for insert
to authenticated
with check (("user" = auth.uid()));


create policy "Users can view their own sentiment analysis"
on "public"."sentiment_analysis"
as permissive
for select
to authenticated
using (("user" = auth.uid()));


CREATE TRIGGER on_image_created AFTER INSERT ON public.ad_structured_output FOR EACH ROW EXECUTE FUNCTION create_library_item();

CREATE TRIGGER on_video_created AFTER INSERT ON public.videos FOR EACH ROW EXECUTE FUNCTION create_library_item();


