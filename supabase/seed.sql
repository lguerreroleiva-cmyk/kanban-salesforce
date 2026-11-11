-- Datos solo para desarrollo local (supabase db reset).
-- El catálogo de tipos de componente se carga en la migración 20261110000100 (aplica también en producción).
--
-- Para convertir a un usuario en administrador de la app (pantalla «Catálogo»):
--   update public.profiles set app_role = 'admin' where email = 'correo@dominio';
select 1;
