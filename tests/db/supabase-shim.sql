-- Emulación mínima de Supabase para ejecutar las migraciones reales en PGlite.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key);
