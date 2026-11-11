-- Reversión de 20261110000000_task_components.sql y 20261110000100_seed_component_types.sql
-- ATENCIÓN: elimina definitivamente los componentes registrados y sus entradas de historial.
-- Respalde antes: \copy public.task_components to 'task_components_backup.csv' csv header
begin;

drop function if exists public.search_task_components(text, int);

drop function if exists public.task_component_snapshot(public.task_components);
drop table if exists public.task_components;   -- arrastra triggers y políticas
drop function if exists public.task_components_audit();
drop function if exists public.task_components_before_write();

drop table if exists public.component_types;
drop function if exists public.component_types_normalize();

drop function if exists public.can_access_task(uuid);
drop function if exists public.html_is_unsafe(text);
drop function if exists public.html_to_plain(text);

delete from public.task_history where entity = 'component';
alter table public.task_history drop constraint if exists task_history_entity_chk;
alter table public.task_history add constraint task_history_entity_chk check (entity in ('task'));

-- Si se usa la CLI de Supabase, quitar las versiones del registro de migraciones:
delete from supabase_migrations.schema_migrations
 where version in ('20261110000000', '20261110000100');

commit;
