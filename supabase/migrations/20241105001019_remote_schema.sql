create policy "Allow authenticated deletes from own folder"
on "storage"."objects"
as permissive
for delete
to authenticated
using (((bucket_id = 'library_videos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


create policy "Allow authenticated reads from own folder"
on "storage"."objects"
as permissive
for select
to authenticated
using (((bucket_id = 'library_videos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


create policy "Allow authenticated reads"
on "storage"."objects"
as permissive
for select
to authenticated
using ((bucket_id = 'library_images'::text));


create policy "Allow authenticated uploads to own folder"
on "storage"."objects"
as permissive
for insert
to authenticated
with check (((bucket_id = 'library_videos'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


create policy "Allow authenticated uploads"
on "storage"."objects"
as permissive
for insert
to authenticated
with check ((bucket_id = 'library_images'::text));



