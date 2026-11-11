import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
import { mapDbError, type DbErrorLike, type MappedError } from '../../lib/errors';
import { sanitizeHtml } from '../../lib/html';
import type { ComponentField, ComponentFormValues, ComponentType, TaskComponent } from './types';
import { DUPLICATE_MESSAGE } from './validation';

const COMPONENT_SELECT =
  '*, component_type:component_types!task_components_component_type_id_fkey(id, name, requires_note, is_active, metadata_type)';

export class ComponentSaveError extends Error {
  constructor(public readonly mapped: MappedError<ComponentField>) {
    super(mapped.formError ?? Object.values(mapped.fieldErrors)[0] ?? 'Error al guardar');
  }
}

const CONSTRAINTS: Record<string, { field?: ComponentField; message: string }> = {
  task_components_task_type_name_uniq: { field: 'component_name', message: DUPLICATE_MESSAGE },
  task_components_name_chk: { field: 'component_name', message: 'El nombre debe tener entre 1 y 255 caracteres.' },
  task_components_note_chk: { field: 'other_type_note', message: 'Máximo 255 caracteres.' },
  task_components_intervention_chk: { field: 'intervention_type', message: 'Tipo de intervención inválido.' },
  task_components_detail_plain_chk: { field: 'work_detail', message: 'Describe el trabajo realizado.' },
  task_components_detail_len_chk: { field: 'work_detail', message: 'El detalle es demasiado largo.' },
};

export function toSaveError(error: DbErrorLike): ComponentSaveError {
  return new ComponentSaveError(mapDbError<ComponentField>(error, CONSTRAINTS));
}

function payload(values: ComponentFormValues) {
  return {
    component_type_id: values.component_type_id,
    component_name: values.component_name.trim(),
    other_type_note: values.other_type_note.trim() || null,
    intervention_type: values.intervention_type,
    work_detail: sanitizeHtml(values.work_detail),
  };
}

// ------------------------------------------------------------------ catálogo
export async function listComponentTypes(opts: { includeInactive?: boolean } = {}): Promise<ComponentType[]> {
  let q = supabase.from('component_types').select('*');
  if (!opts.includeInactive) q = q.eq('is_active', true);
  const { data, error } = await q.order('sort_order').order('name');
  if (error) throw error;
  return data;
}

export async function createComponentType(input: {
  name: string; metadata_type?: string | null; requires_note?: boolean; sort_order?: number;
}): Promise<ComponentType> {
  const { data, error } = await supabase.from('component_types').insert(input).select('*').single();
  if (error) throw translateTypeError(error);
  return data;
}

export async function updateComponentType(
  id: string,
  patch: Database['public']['Tables']['component_types']['Update'],
): Promise<ComponentType> {
  const { data, error } = await supabase.from('component_types').update(patch).eq('id', id).select('*').single();
  if (error) throw translateTypeError(error);
  return data;
}

/** Persiste el orden mostrado (10, 20, 30...). */
export async function reorderComponentTypes(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from('component_types').update({ sort_order: (i + 1) * 10 }).eq('id', id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw translateTypeError(failed.error);
}

export async function deleteComponentType(id: string): Promise<void> {
  const { error } = await supabase.from('component_types').delete().eq('id', id);
  if (error) throw translateTypeError(error);
}

/** Cantidad de componentes registrados por tipo, en todas las tareas (solo admin). */
export async function getComponentTypeUsage(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('component_type_usage');
  if (error) throw translateTypeError(error);
  return new Map((data ?? []).map((r) => [r.component_type_id, Number(r.usage_count)]));
}

/** Mueve los componentes de `sourceId` a `targetId` y elimina `sourceId`. Devuelve cuántos movió. */
export async function mergeComponentTypes(sourceId: string, targetId: string): Promise<number> {
  const { data, error } = await supabase.rpc('merge_component_types', { p_source: sourceId, p_target: targetId });
  if (error) {
    // Los mensajes de la función ya están redactados para el usuario (conflictos, destino inactivo...).
    throw error.hint === 'field:target' || error.code === '23505' ? new Error(error.message) : translateTypeError(error);
  }
  return data ?? 0;
}

export function translateTypeError(error: DbErrorLike): Error {
  if (error.code === '23505') return new Error('Ya existe un tipo con ese nombre.');
  if (error.code === '23503') {
    return new Error('El tipo está en uso por componentes registrados. Desactívalo en lugar de eliminarlo.');
  }
  if (error.code === '42501') return new Error('Solo los administradores pueden modificar el catálogo.');
  return new Error(error.message ?? 'Error en el catálogo');
}

// ------------------------------------------------------------------ componentes
export async function listTaskComponents(taskId: string): Promise<TaskComponent[]> {
  const { data, error } = await supabase
    .from('task_components')
    .select(COMPONENT_SELECT)
    .eq('task_id', taskId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data as unknown as TaskComponent[];
}

export async function listComponentsForTasks(taskIds: string[]): Promise<TaskComponent[]> {
  const out: TaskComponent[] = [];
  // Lotes para no exceder el largo de URL de PostgREST.
  for (let i = 0; i < taskIds.length; i += 100) {
    const { data, error } = await supabase
      .from('task_components')
      .select(COMPONENT_SELECT)
      .in('task_id', taskIds.slice(i, i + 100))
      .order('sort_order')
      .order('created_at');
    if (error) throw error;
    out.push(...(data as unknown as TaskComponent[]));
  }
  return out;
}

/** Cantidad de componentes por tarea (para las tarjetas del tablero). */
export async function countComponentsByTask(taskIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let i = 0; i < taskIds.length; i += 100) {
    const { data, error } = await supabase.from('task_components').select('task_id').in('task_id', taskIds.slice(i, i + 100));
    if (error) throw error;
    for (const r of data) counts.set(r.task_id, (counts.get(r.task_id) ?? 0) + 1);
  }
  return counts;
}

export async function createTaskComponent(
  taskId: string, values: ComponentFormValues, sortOrder = 0,
): Promise<TaskComponent> {
  const { data, error } = await supabase
    .from('task_components')
    .insert({ task_id: taskId, sort_order: sortOrder, ...payload(values) })
    .select(COMPONENT_SELECT)
    .single();
  if (error) throw toSaveError(error);
  return data as unknown as TaskComponent;
}

export async function updateTaskComponent(id: string, values: ComponentFormValues): Promise<TaskComponent> {
  const { data, error } = await supabase
    .from('task_components')
    .update(payload(values))
    .eq('id', id)
    .select(COMPONENT_SELECT)
    .single();
  if (error) throw toSaveError(error);
  return data as unknown as TaskComponent;
}

export async function deleteTaskComponent(id: string): Promise<void> {
  const { error, count } = await supabase.from('task_components').delete({ count: 'exact' }).eq('id', id);
  if (error) throw toSaveError(error);
  if (count === 0) throw new Error('El componente ya no existe o no tienes permisos para eliminarlo.');
}

export type ComponentSearchResult =
  Database['public']['Functions']['search_task_components']['Returns'][number];

export async function searchComponents(query: string): Promise<ComponentSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('search_task_components', { p_query: q });
  if (error) throw error;
  return data ?? [];
}
