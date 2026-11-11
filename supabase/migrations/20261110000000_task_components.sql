-- =============================================================================
-- REQUISITO: Registro de componentes Salesforce por tarea.
-- Reversible con: supabase/rollback/20261110000000_task_components_down.sql
--
-- Reutiliza:
--   * public.is_board_member()  -> regla de acceso a tareas (vía can_access_task)
--   * public.is_app_admin()     -> escritura del catálogo
--   * public.task_history       -> historial (se amplía entity a 'component')
--   * public.set_updated_at()   -> updated_at
--
-- Convención de errores: las validaciones de negocio lanzan errcode 23514 con
-- HINT = 'field:<columna>' para que el cliente asocie el mensaje al campo.
-- =============================================================================

-- ---------------------------------------------------------------- catálogo
create table public.component_types (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  metadata_type  text,
  requires_note  boolean not null default false,
  sort_order     int  not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint component_types_name_chk
    check (char_length(name) between 1 and 100 and name = btrim(name)),
  constraint component_types_metadata_type_chk
    check (metadata_type is null or char_length(btrim(metadata_type)) between 1 and 120)
);

create unique index component_types_name_lower_uniq on public.component_types (lower(name));
create index component_types_active_sort_idx on public.component_types (is_active, sort_order, name);

create trigger component_types_set_updated_at
  before update on public.component_types
  for each row execute function public.set_updated_at();

create or replace function public.component_types_normalize()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.name := btrim(coalesce(new.name, ''));
  new.metadata_type := nullif(btrim(coalesce(new.metadata_type, '')), '');
  return new;
end;
$$;

create trigger component_types_normalize
  before insert or update on public.component_types
  for each row execute function public.component_types_normalize();

-- ---------------------------------------------------------------- utilidades
-- Texto plano derivado del HTML del editor (resumen, búsqueda y exportación).
create or replace function public.html_to_plain(p_html text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
           replace(replace(replace(replace(replace(replace(
             regexp_replace(
               regexp_replace(coalesce(p_html, ''),
                 '<(br|/p|/li|/h[1-6]|/blockquote|/pre|/div)[^>]*>', ' ', 'gi'),
               '<[^>]*>', '', 'g'),
             '&nbsp;', ' '), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&#39;', ''''), '&amp;', '&'),
           '\s+', ' ', 'g'));
$$;

-- Defensa en profundidad: rechaza HTML con vectores XSS evidentes.
-- (El cliente ya sanitiza con DOMPurify al guardar y al renderizar.)
create or replace function public.html_is_unsafe(p_html text)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select coalesce(p_html, '') ~* '<\s*/?\s*(script|iframe|object|embed|style|link|meta|base|form|svg|math)\M'
      or coalesce(p_html, '') ~* '<[^>]*\son[a-z]+\s*='
      or coalesce(p_html, '') ~* '<[^>]*(javascript|vbscript|data)\s*:';
$$;

-- Replica EXACTAMENTE la regla de acceso de public.tasks (miembro del tablero).
create or replace function public.can_access_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and public.is_board_member(t.board_id)
  );
$$;

-- ---------------------------------------------------------------- componentes
create table public.task_components (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.tasks (id) on delete cascade,
  component_type_id  uuid not null references public.component_types (id) on delete restrict,
  component_name     text not null,
  other_type_note    text,
  intervention_type  text not null,
  work_detail        text not null,                 -- HTML de Tiptap (mismo formato que tasks.description)
  work_detail_plain  text not null default '',      -- derivado por trigger; el valor del cliente se ignora
  sort_order         int  not null default 0,
  created_by         uuid not null default auth.uid() references auth.users (id),
  updated_by         uuid not null default auth.uid() references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint task_components_name_chk
    check (char_length(component_name) between 1 and 255 and component_name = btrim(component_name)),
  constraint task_components_note_chk
    check (other_type_note is null or char_length(other_type_note) between 1 and 255),
  constraint task_components_intervention_chk
    check (intervention_type in ('new', 'updated', 'configured')),
  constraint task_components_detail_len_chk
    check (char_length(work_detail) <= 100000),
  constraint task_components_detail_plain_chk
    check (char_length(btrim(work_detail_plain)) > 0)
);

create index task_components_task_idx on public.task_components (task_id);
create index task_components_type_name_idx on public.task_components (component_type_id, lower(component_name));
create unique index task_components_task_type_name_uniq
  on public.task_components (task_id, component_type_id, lower(component_name));
create index task_components_name_lower_idx on public.task_components (lower(component_name));

-- Normalización, validaciones de negocio y autoría (no se confía en el cliente).
create or replace function public.task_components_before_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_type public.component_types%rowtype;
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    if new.task_id is distinct from old.task_id then
      raise exception 'Un componente no puede moverse a otra tarea'
        using errcode = '23514', hint = 'field:task_id';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
  new.updated_at := now();

  -- Nombre (API Name)
  new.component_name := btrim(coalesce(new.component_name, ''));
  if new.component_name = '' then
    raise exception 'El nombre del componente es obligatorio'
      using errcode = '23514', hint = 'field:component_name';
  end if;
  if char_length(new.component_name) > 255 then
    raise exception 'El nombre del componente no puede superar 255 caracteres'
      using errcode = '23514', hint = 'field:component_name';
  end if;

  -- Tipo
  select * into v_type from public.component_types where id = new.component_type_id;
  if not found then
    raise exception 'Selecciona un tipo de componente válido'
      using errcode = '23503', hint = 'field:component_type_id';
  end if;
  if not v_type.is_active
     and (tg_op = 'INSERT' or new.component_type_id is distinct from old.component_type_id) then
    raise exception 'El tipo «%» está inactivo y no puede usarse en nuevos registros', v_type.name
      using errcode = '23514', hint = 'field:component_type_id';
  end if;

  -- «Especificar tipo»: obligatorio solo si el tipo lo requiere
  new.other_type_note := nullif(btrim(coalesce(new.other_type_note, '')), '');
  if v_type.requires_note then
    if new.other_type_note is null then
      raise exception 'Debes especificar el tipo cuando seleccionas «%»', v_type.name
        using errcode = '23514', hint = 'field:other_type_note';
    end if;
  else
    new.other_type_note := null;
  end if;

  -- Intervención
  if new.intervention_type is null or new.intervention_type not in ('new', 'updated', 'configured') then
    raise exception 'Selecciona el tipo de intervención'
      using errcode = '23514', hint = 'field:intervention_type';
  end if;

  -- Detalle enriquecido
  new.work_detail := coalesce(new.work_detail, '');
  if public.html_is_unsafe(new.work_detail) then
    raise exception 'El detalle contiene contenido no permitido (scripts o atributos de evento)'
      using errcode = '23514', hint = 'field:work_detail';
  end if;
  new.work_detail_plain := public.html_to_plain(new.work_detail);
  if new.work_detail_plain = '' then
    raise exception 'El detalle del trabajo realizado es obligatorio'
      using errcode = '23514', hint = 'field:work_detail';
  end if;

  return new;
end;
$$;

create trigger task_components_before_write
  before insert or update on public.task_components
  for each row execute function public.task_components_before_write();

-- ---------------------------------------------------------------- historial
alter table public.task_history drop constraint task_history_entity_chk;
alter table public.task_history add constraint task_history_entity_chk
  check (entity in ('task', 'component'));

create or replace function public.task_component_snapshot(p public.task_components)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id,
    'task_id', p.task_id,
    'component_type_id', p.component_type_id,
    'component_type_name', (select ct.name from public.component_types ct where ct.id = p.component_type_id),
    'component_name', p.component_name,
    'other_type_note', p.other_type_note,
    'intervention_type', p.intervention_type,
    'work_detail', p.work_detail,
    'work_detail_plain', p.work_detail_plain,
    'sort_order', p.sort_order,
    'created_by', p.created_by,
    'updated_by', p.updated_by,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  );
$$;

create or replace function public.task_components_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_type_name text;
begin
  if tg_op = 'INSERT' then
    select name into v_type_name from public.component_types where id = new.component_type_id;
    insert into public.task_history (task_id, actor_id, entity, entity_id, action, summary, changes, snapshot)
    values (new.task_id, coalesce(auth.uid(), new.created_by), 'component', new.id, 'created',
            format('Componente agregado: %s · %s', v_type_name, new.component_name),
            '{}'::jsonb, public.task_component_snapshot(new));
    return null;

  elsif tg_op = 'UPDATE' then
    if new.component_type_id is distinct from old.component_type_id then
      v_changes := v_changes || jsonb_build_object('component_type', jsonb_build_object(
        'old', (select name from public.component_types where id = old.component_type_id),
        'new', (select name from public.component_types where id = new.component_type_id)));
    end if;
    if new.component_name is distinct from old.component_name then
      v_changes := v_changes || jsonb_build_object('component_name',
        jsonb_build_object('old', old.component_name, 'new', new.component_name));
    end if;
    if new.other_type_note is distinct from old.other_type_note then
      v_changes := v_changes || jsonb_build_object('other_type_note',
        jsonb_build_object('old', old.other_type_note, 'new', new.other_type_note));
    end if;
    if new.intervention_type is distinct from old.intervention_type then
      v_changes := v_changes || jsonb_build_object('intervention_type',
        jsonb_build_object('old', old.intervention_type, 'new', new.intervention_type));
    end if;
    if new.work_detail is distinct from old.work_detail then
      v_changes := v_changes || jsonb_build_object('work_detail',
        jsonb_build_object('old', old.work_detail_plain, 'new', new.work_detail_plain));
    end if;
    if new.sort_order is distinct from old.sort_order then
      v_changes := v_changes || jsonb_build_object('sort_order',
        jsonb_build_object('old', old.sort_order, 'new', new.sort_order));
    end if;

    if v_changes = '{}'::jsonb then
      return null;
    end if;

    select name into v_type_name from public.component_types where id = new.component_type_id;
    insert into public.task_history (task_id, actor_id, entity, entity_id, action, summary, changes, snapshot)
    values (new.task_id, coalesce(auth.uid(), new.updated_by), 'component', new.id, 'updated',
            format('Componente actualizado: %s · %s', v_type_name, new.component_name),
            v_changes, public.task_component_snapshot(new));
    return null;

  else -- DELETE
    -- Borrado en cascada desde la tarea: el historial de la tarea también se elimina.
    if not exists (select 1 from public.tasks where id = old.task_id) then
      return null;
    end if;
    select name into v_type_name from public.component_types where id = old.component_type_id;
    insert into public.task_history (task_id, actor_id, entity, entity_id, action, summary, changes, snapshot)
    values (old.task_id, auth.uid(), 'component', old.id, 'deleted',
            format('Componente eliminado: %s · %s', v_type_name, old.component_name),
            '{}'::jsonb, public.task_component_snapshot(old));
    return null;
  end if;
end;
$$;

create trigger task_components_audit
  after insert or update or delete on public.task_components
  for each row execute function public.task_components_audit();

-- ---------------------------------------------------------------- búsqueda entre tareas
-- SECURITY INVOKER: RLS de tasks/boards/task_components se aplica automáticamente.
create or replace function public.search_task_components(p_query text, p_limit int default 200)
returns table (
  component_id        uuid,
  task_id             uuid,
  task_title          text,
  board_id            uuid,
  board_name          text,
  component_type_id   uuid,
  component_type_name text,
  component_name      text,
  intervention_type   text,
  work_detail_plain   text,
  created_at          timestamptz,
  updated_at          timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select lower(btrim(coalesce(p_query, ''))) as term
  )
  select tc.id, t.id, t.title, b.id, b.name, ct.id, ct.name, tc.component_name,
         tc.intervention_type, tc.work_detail_plain, tc.created_at, tc.updated_at
  from public.task_components tc
  join public.tasks t           on t.id = tc.task_id
  join public.boards b          on b.id = t.board_id
  join public.component_types ct on ct.id = tc.component_type_id
  cross join q
  where q.term <> ''
    and lower(tc.component_name) like '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by (lower(tc.component_name) = q.term) desc, lower(tc.component_name), tc.updated_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

-- ---------------------------------------------------------------- RLS
alter table public.component_types enable row level security;
alter table public.task_components enable row level security;

create policy component_types_select on public.component_types
  for select to authenticated using (true);
create policy component_types_insert on public.component_types
  for insert to authenticated with check (public.is_app_admin());
create policy component_types_update on public.component_types
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy component_types_delete on public.component_types
  for delete to authenticated using (public.is_app_admin());

create policy task_components_select on public.task_components
  for select to authenticated using (public.can_access_task(task_id));
create policy task_components_insert on public.task_components
  for insert to authenticated with check (
    public.can_access_task(task_id) and created_by = auth.uid() and updated_by = auth.uid()
  );
create policy task_components_update on public.task_components
  for update to authenticated using (public.can_access_task(task_id))
  with check (public.can_access_task(task_id) and updated_by = auth.uid());
create policy task_components_delete on public.task_components
  for delete to authenticated using (public.can_access_task(task_id));

grant select, insert, update, delete on public.component_types, public.task_components to authenticated;

revoke execute on function public.can_access_task(uuid), public.task_component_snapshot(public.task_components)
  from public, anon;
grant execute on function public.can_access_task(uuid) to authenticated;
grant execute on function public.search_task_components(text, int) to authenticated;
revoke execute on function public.search_task_components(text, int) from anon;
