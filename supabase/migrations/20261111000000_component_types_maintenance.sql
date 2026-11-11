-- =============================================================================
-- Mantenedor del catálogo de tipos de componente:
--   * component_type_usage(): cuántos componentes usa cada tipo (en TODAS las tareas).
--   * merge_component_types(): mueve los componentes de un tipo a otro y elimina el origen
--     (para depurar tipos duplicados que estén en uso).
-- Ambas son solo para administradores (is_app_admin()).
-- Reversión: supabase/rollback/20261111000000_component_types_maintenance_down.sql
-- =============================================================================

create or replace function public.component_type_usage()
returns table (component_type_id uuid, usage_count bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Solo los administradores pueden consultar el uso del catálogo'
      using errcode = '42501';
  end if;
  return query
    select ct.id, count(tc.id)
    from public.component_types ct
    left join public.task_components tc on tc.component_type_id = ct.id
    group by ct.id;
end;
$$;

create or replace function public.merge_component_types(p_source uuid, p_target uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.component_types%rowtype;
  v_target public.component_types%rowtype;
  v_conflicts int;
  v_moved int;
begin
  if not public.is_app_admin() then
    raise exception 'Solo los administradores pueden fusionar tipos'
      using errcode = '42501';
  end if;
  if p_source is null or p_target is null or p_source = p_target then
    raise exception 'Selecciona un tipo de destino distinto al de origen'
      using errcode = '22023', hint = 'field:target';
  end if;

  select * into v_source from public.component_types where id = p_source for update;
  if not found then
    raise exception 'El tipo de origen no existe' using errcode = 'P0002';
  end if;
  select * into v_target from public.component_types where id = p_target for update;
  if not found then
    raise exception 'El tipo de destino no existe' using errcode = 'P0002', hint = 'field:target';
  end if;
  if not v_target.is_active then
    raise exception 'El tipo de destino «%» está inactivo; actívalo antes de fusionar', v_target.name
      using errcode = '23514', hint = 'field:target';
  end if;

  -- Una tarea no puede quedar con el mismo componente repetido bajo el tipo destino.
  select count(*) into v_conflicts
  from public.task_components s
  join public.task_components t
    on t.task_id = s.task_id
   and t.component_type_id = p_target
   and lower(t.component_name) = lower(s.component_name)
  where s.component_type_id = p_source;

  if v_conflicts > 0 then
    raise exception 'No se puede fusionar: % tarea(s) ya tienen el mismo componente registrado como «%»',
      v_conflicts, v_target.name
      using errcode = '23505', hint = 'field:target';
  end if;

  -- El trigger de auditoría registra el cambio de tipo en el historial de cada tarea.
  update public.task_components set component_type_id = p_target where component_type_id = p_source;
  get diagnostics v_moved = row_count;

  delete from public.component_types where id = p_source;
  return v_moved;
end;
$$;

revoke execute on function public.component_type_usage(), public.merge_component_types(uuid, uuid) from public, anon;
grant execute on function public.component_type_usage(), public.merge_component_types(uuid, uuid) to authenticated;
