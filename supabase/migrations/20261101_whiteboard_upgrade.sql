-- Upgrade drawable Whiteboard to support multiple named boards.
-- Existing single-board data remains as "Main Board".

alter table public.whiteboard_drawings
  drop constraint if exists whiteboard_drawings_user_id_key;

create unique index if not exists whiteboard_drawings_user_title_unique
on public.whiteboard_drawings(user_id,title);

NOTIFY pgrst,'reload schema';
