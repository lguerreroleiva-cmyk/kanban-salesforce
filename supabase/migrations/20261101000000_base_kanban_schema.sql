-- =============================================================================
-- Esquema base de la app Kanban (tableros, columnas, tareas, historial).
-- Patrones que reutiliza la migración de componentes:
--   * Acceso a tareas: membresía del tablero  -> public.is_board_member(board_id)
--   * Administración de la app: profiles.app_role = 'admin' -> public.is_app_admin()
--   * Historial: tabla public.task_history escrita SOLO por triggers SECURITY DEFINER
--   * updated_at: trigger genérico public.set_updated_at()
--   * Contenido enriquecido: HTML generado por Tiptap (tasks.description)
-- =============================================================================

-- ---------------------------------------------------------------- utilidades
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- perfiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  app_role    text not null default 'member'
              constraint profiles_app_role_chk check (app_role in ('admin', 'member')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.app_role = 'admin'
  );
$$;

-- Un usuario no puede auto-promoverse a administrador.
create or replace function public.profiles_protect_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.app_role is distinct from old.app_role
     and auth.uid() is not null
     and not public.is_app_admin() then
    raise exception 'Solo un administrador puede cambiar roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.profiles_protect_role();

-- ---------------------------------------------------------------- tableros
create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null constraint boards_name_chk
              check (char_length(btrim(name)) between 1 and 120),
  owner_id    uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.board_members (
  board_id    uuid not null references public.boards (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member'
              constraint board_members_role_chk check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index board_members_user_idx on public.board_members (user_id);

create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.board_members m
    where m.board_id = p_board_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_board_owner(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.board_members m
    where m.board_id = p_board_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create table public.board_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  name        text not null constraint board_columns_name_chk
              check (char_length(btrim(name)) between 1 and 80),
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  constraint board_columns_id_board_uniq unique (id, board_id)
);
create index board_columns_board_idx on public.board_columns (board_id, position);

-- Al crear un tablero: el creador queda como owner y se crean columnas por defecto.
create or replace function public.handle_new_board()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;

  insert into public.board_columns (board_id, name, position) values
    (new.id, 'Por hacer', 0),
    (new.id, 'En progreso', 1),
    (new.id, 'Hecho', 2);
  return new;
end;
$$;

create trigger on_board_created
  after insert on public.boards
  for each row execute function public.handle_new_board();

-- ---------------------------------------------------------------- tareas
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.boards (id) on delete cascade,
  column_id    uuid not null,
  title        text not null constraint tasks_title_chk
               check (char_length(btrim(title)) between 1 and 200),
  description  text not null default '',          -- HTML de Tiptap
  position     int  not null default 0,
  assignee_id  uuid references auth.users (id) on delete set null,
  due_date     date,
  created_by   uuid not null default auth.uid() references auth.users (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tasks_column_fk foreign key (column_id, board_id)
    references public.board_columns (id, board_id) on delete cascade
);
create index tasks_board_idx  on public.tasks (board_id);
create index tasks_column_idx on public.tasks (column_id, position);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- historial
create table public.task_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  entity      text not null default 'task'
              constraint task_history_entity_chk check (entity in ('task')),
  entity_id   uuid,
  action      text not null,          -- created | updated | deleted | moved ...
  summary     text,
  changes     jsonb not null default '{}'::jsonb,  -- { campo: { old, new } }
  snapshot    jsonb,
  created_at  timestamptz not null default now()
);
create index task_history_task_idx on public.task_history (task_id, created_at desc);

create or replace function public.tasks_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.task_history (task_id, actor_id, entity, entity_id, action, summary)
    values (new.id, coalesce(auth.uid(), new.created_by), 'task', new.id, 'created',
            format('Tarea creada: %s', new.title));
    return null;
  end if;

  if new.title is distinct from old.title then
    v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', old.title, 'new', new.title));
  end if;
  if new.description is distinct from old.description then
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('old', null, 'new', null, 'changed', true));
  end if;
  if new.column_id is distinct from old.column_id then
    v_changes := v_changes || jsonb_build_object('column_id', jsonb_build_object(
      'old', (select name from public.board_columns where id = old.column_id),
      'new', (select name from public.board_columns where id = new.column_id)));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    v_changes := v_changes || jsonb_build_object('assignee_id', jsonb_build_object('old', old.assignee_id, 'new', new.assignee_id));
  end if;
  if new.due_date is distinct from old.due_date then
    v_changes := v_changes || jsonb_build_object('due_date', jsonb_build_object('old', old.due_date, 'new', new.due_date));
  end if;

  if v_changes <> '{}'::jsonb then
    insert into public.task_history (task_id, actor_id, entity, entity_id, action, summary, changes)
    values (new.id, auth.uid(), 'task', new.id,
            case when v_changes ? 'column_id' and (select count(*) from jsonb_object_keys(v_changes)) = 1
                 then 'moved' else 'updated' end,
            format('Tarea actualizada: %s', new.title), v_changes);
  end if;
  return null;
end;
$$;

create trigger tasks_audit
  after insert or update on public.tasks
  for each row execute function public.tasks_audit();

-- ---------------------------------------------------------------- RLS
alter table public.profiles      enable row level security;
alter table public.boards        enable row level security;
alter table public.board_members enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks         enable row level security;
alter table public.task_history  enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_app_admin())
  with check (id = auth.uid() or public.is_app_admin());

create policy boards_select on public.boards
  for select to authenticated using (public.is_board_member(id) or owner_id = auth.uid());
create policy boards_insert on public.boards
  for insert to authenticated with check (owner_id = auth.uid());
create policy boards_update on public.boards
  for update to authenticated using (public.is_board_owner(id)) with check (public.is_board_owner(id));
create policy boards_delete on public.boards
  for delete to authenticated using (public.is_board_owner(id));

create policy board_members_select on public.board_members
  for select to authenticated using (public.is_board_member(board_id));
create policy board_members_insert on public.board_members
  for insert to authenticated with check (public.is_board_owner(board_id));
create policy board_members_delete on public.board_members
  for delete to authenticated using (public.is_board_owner(board_id) or user_id = auth.uid());

create policy board_columns_all on public.board_columns
  for all to authenticated using (public.is_board_member(board_id))
  with check (public.is_board_member(board_id));

-- REGLA DE ACCESO A TAREAS: ser miembro del tablero de la tarea.
create policy tasks_select on public.tasks
  for select to authenticated using (public.is_board_member(board_id));
create policy tasks_insert on public.tasks
  for insert to authenticated with check (public.is_board_member(board_id) and created_by = auth.uid());
create policy tasks_update on public.tasks
  for update to authenticated using (public.is_board_member(board_id))
  with check (public.is_board_member(board_id));
create policy tasks_delete on public.tasks
  for delete to authenticated using (public.is_board_member(board_id));

-- El historial solo se lee; lo escriben los triggers SECURITY DEFINER.
create policy task_history_select on public.task_history
  for select to authenticated using (
    exists (select 1 from public.tasks t where t.id = task_id and public.is_board_member(t.board_id))
  );

grant select, insert, update, delete on
  public.profiles, public.boards, public.board_members, public.board_columns, public.tasks
  to authenticated;
grant select on public.task_history to authenticated;

revoke execute on function public.is_board_member(uuid), public.is_board_owner(uuid), public.is_app_admin()
  from public, anon;
grant execute on function public.is_board_member(uuid), public.is_board_owner(uuid), public.is_app_admin()
  to authenticated;
