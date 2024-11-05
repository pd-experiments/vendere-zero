create table "public"."video_frames_mapping" (
    "id" uuid not null default gen_random_uuid(),
    "video_id" uuid not null,
    "frame_id" uuid not null,
    "frame_number" integer not null,
    "video_timestamp" interval not null,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "user_id" uuid
);


create table "public"."videos" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "user_id" uuid,
    "mapping_id" uuid default gen_random_uuid()
);


CREATE INDEX idx_video_frames_frame_id ON public.video_frames_mapping USING btree (frame_id);

CREATE INDEX idx_video_frames_user_id ON public.video_frames_mapping USING btree (user_id);

CREATE INDEX idx_video_frames_video_id ON public.video_frames_mapping USING btree (video_id);

CREATE UNIQUE INDEX unique_frame_per_video ON public.video_frames_mapping USING btree (video_id, frame_number);

CREATE UNIQUE INDEX video_frames_mapping_pkey ON public.video_frames_mapping USING btree (id);

CREATE UNIQUE INDEX videos_pkey ON public.videos USING btree (id);

alter table "public"."video_frames_mapping" add constraint "video_frames_mapping_pkey" PRIMARY KEY using index "video_frames_mapping_pkey";

alter table "public"."videos" add constraint "videos_pkey" PRIMARY KEY using index "videos_pkey";

alter table "public"."video_frames_mapping" add constraint "frame_number_positive" CHECK ((frame_number >= 0)) not valid;

alter table "public"."video_frames_mapping" validate constraint "frame_number_positive";

alter table "public"."video_frames_mapping" add constraint "unique_frame_per_video" UNIQUE using index "unique_frame_per_video";

alter table "public"."video_frames_mapping" add constraint "video_frames_mapping_frame_id_fkey" FOREIGN KEY (frame_id) REFERENCES ad_structured_output(id) ON DELETE CASCADE not valid;

alter table "public"."video_frames_mapping" validate constraint "video_frames_mapping_frame_id_fkey";

alter table "public"."video_frames_mapping" add constraint "video_frames_mapping_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."video_frames_mapping" validate constraint "video_frames_mapping_user_id_fkey";

alter table "public"."video_frames_mapping" add constraint "video_frames_mapping_video_id_fkey" FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE not valid;

alter table "public"."video_frames_mapping" validate constraint "video_frames_mapping_video_id_fkey";

alter table "public"."videos" add constraint "videos_mapping_id_fkey" FOREIGN KEY (mapping_id) REFERENCES video_frames_mapping(id) not valid;

alter table "public"."videos" validate constraint "videos_mapping_id_fkey";

alter table "public"."videos" add constraint "videos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."videos" validate constraint "videos_user_id_fkey";

grant delete on table "public"."video_frames_mapping" to "anon";

grant insert on table "public"."video_frames_mapping" to "anon";

grant references on table "public"."video_frames_mapping" to "anon";

grant select on table "public"."video_frames_mapping" to "anon";

grant trigger on table "public"."video_frames_mapping" to "anon";

grant truncate on table "public"."video_frames_mapping" to "anon";

grant update on table "public"."video_frames_mapping" to "anon";

grant delete on table "public"."video_frames_mapping" to "authenticated";

grant insert on table "public"."video_frames_mapping" to "authenticated";

grant references on table "public"."video_frames_mapping" to "authenticated";

grant select on table "public"."video_frames_mapping" to "authenticated";

grant trigger on table "public"."video_frames_mapping" to "authenticated";

grant truncate on table "public"."video_frames_mapping" to "authenticated";

grant update on table "public"."video_frames_mapping" to "authenticated";

grant delete on table "public"."video_frames_mapping" to "service_role";

grant insert on table "public"."video_frames_mapping" to "service_role";

grant references on table "public"."video_frames_mapping" to "service_role";

grant select on table "public"."video_frames_mapping" to "service_role";

grant trigger on table "public"."video_frames_mapping" to "service_role";

grant truncate on table "public"."video_frames_mapping" to "service_role";

grant update on table "public"."video_frames_mapping" to "service_role";

grant delete on table "public"."videos" to "anon";

grant insert on table "public"."videos" to "anon";

grant references on table "public"."videos" to "anon";

grant select on table "public"."videos" to "anon";

grant trigger on table "public"."videos" to "anon";

grant truncate on table "public"."videos" to "anon";

grant update on table "public"."videos" to "anon";

grant delete on table "public"."videos" to "authenticated";

grant insert on table "public"."videos" to "authenticated";

grant references on table "public"."videos" to "authenticated";

grant select on table "public"."videos" to "authenticated";

grant trigger on table "public"."videos" to "authenticated";

grant truncate on table "public"."videos" to "authenticated";

grant update on table "public"."videos" to "authenticated";

grant delete on table "public"."videos" to "service_role";

grant insert on table "public"."videos" to "service_role";

grant references on table "public"."videos" to "service_role";

grant select on table "public"."videos" to "service_role";

grant trigger on table "public"."videos" to "service_role";

grant truncate on table "public"."videos" to "service_role";

grant update on table "public"."videos" to "service_role";

create policy "Users can delete their own video frames"
on "public"."video_frames_mapping"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own video frames"
on "public"."video_frames_mapping"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own video frames"
on "public"."video_frames_mapping"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view their own video frames"
on "public"."video_frames_mapping"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can delete their own videos"
on "public"."videos"
as permissive
for delete
to public
using ((auth.uid() = user_id));


create policy "Users can insert their own videos"
on "public"."videos"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Users can update their own videos"
on "public"."videos"
as permissive
for update
to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Users can view their own videos"
on "public"."videos"
as permissive
for select
to public
using ((auth.uid() = user_id));


