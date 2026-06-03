-- 011_project_post_link.sql
-- T45.A: attach an existing post to a project as its embedded writeup.
-- A project may reference one post via post_id; the post's body renders
-- below the project card on the detail page (Override 3). Nullable, and the
-- FK uses ON DELETE SET NULL so deleting the post quietly unlinks it rather
-- than cascading. Mirrors the image_after_id pattern from migration 009.
-- Idempotent: drop-then-add the constraint so re-applies are safe.

alter table public.projects
  add column if not exists post_id uuid null;

alter table public.projects
  drop constraint if exists projects_post_id_fkey;

alter table public.projects
  add constraint projects_post_id_fkey
  foreign key (post_id) references public.posts(id) on delete set null;
