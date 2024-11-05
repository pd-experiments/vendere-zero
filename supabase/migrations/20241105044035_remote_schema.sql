alter table "public"."videos" drop constraint "videos_mapping_id_fkey";

alter table "public"."videos" drop column "mapping_id";

alter table "public"."videos" add column "mappings" uuid[] default ARRAY[]::uuid[];

alter table "public"."videos" add column "video_url" text not null;

CREATE UNIQUE INDEX videos_video_url_key ON public.videos USING btree (video_url);

alter table "public"."videos" add constraint "videos_video_url_key" UNIQUE using index "videos_video_url_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_mapping_ids()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unnest(NEW.mappings) AS mapping_id
    LEFT JOIN video_frames_mapping ON video_frames_mapping.id = mapping_id
    WHERE video_frames_mapping.id IS NULL
  ) THEN
    RAISE EXCEPTION 'All mapping IDs must exist in video_frames_mapping table';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER validate_mapping_ids BEFORE INSERT OR UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION check_mapping_ids();


