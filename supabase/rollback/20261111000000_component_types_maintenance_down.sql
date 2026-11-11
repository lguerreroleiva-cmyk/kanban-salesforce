-- Reversión de 20261111000000_component_types_maintenance.sql (no borra datos).
drop function if exists public.merge_component_types(uuid, uuid);
drop function if exists public.component_type_usage();
