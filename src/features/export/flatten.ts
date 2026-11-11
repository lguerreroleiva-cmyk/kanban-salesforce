import { htmlToPlainText } from '../../lib/html';
import type { BoardColumn, Profile, Task } from '../boards/api';
import { displayTypeName, interventionLabel, type TaskComponent } from '../components/types';

/** Columnas de la exportación de tareas (se agregan las dos últimas para componentes). */
export const TASK_HEADERS = [
  { key: 'task_id', label: 'ID tarea' },
  { key: 'title', label: 'Título' },
  { key: 'column', label: 'Columna' },
  { key: 'description', label: 'Descripción' },
  { key: 'due_date', label: 'Fecha límite' },
  { key: 'created_at', label: 'Creada' },
  { key: 'updated_at', label: 'Actualizada' },
  { key: 'components_count', label: 'N° componentes' },
  { key: 'components_summary', label: 'Componentes (resumen)' },
] as const;

/** Una fila por componente (hoja/archivo adicional). */
export const COMPONENT_HEADERS = [
  { key: 'task_id', label: 'ID tarea' },
  { key: 'task_title', label: 'Título de tarea' },
  { key: 'component_type', label: 'Tipo' },
  { key: 'metadata_type', label: 'Metadata API' },
  { key: 'component_name', label: 'Nombre (API Name)' },
  { key: 'intervention', label: 'Intervención' },
  { key: 'work_detail', label: 'Detalle (texto plano)' },
  { key: 'created_by', label: 'Creado por' },
  { key: 'created_at', label: 'Fecha creación' },
  { key: 'updated_by', label: 'Actualizado por' },
  { key: 'updated_at', label: 'Fecha actualización' },
] as const;

export type TaskRow = Record<(typeof TASK_HEADERS)[number]['key'], string | number>;
export type ComponentRow = Record<(typeof COMPONENT_HEADERS)[number]['key'], string>;

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function groupByTask(components: TaskComponent[]): Map<string, TaskComponent[]> {
  const map = new Map<string, TaskComponent[]>();
  for (const c of components) {
    const list = map.get(c.task_id) ?? [];
    list.push(c);
    map.set(c.task_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  }
  return map;
}

export function componentSummary(list: TaskComponent[]): string {
  return list
    .map((c) => `${displayTypeName(c)}: ${c.component_name} (${interventionLabel(c.intervention_type)})`)
    .join('; ');
}

export function buildTaskRows(tasks: Task[], columns: BoardColumn[], components: TaskComponent[]): TaskRow[] {
  const colName = new Map(columns.map((c) => [c.id, c.name]));
  const byTask = groupByTask(components);
  return tasks.map((t) => {
    const list = byTask.get(t.id) ?? [];
    return {
      task_id: t.id,
      title: t.title,
      column: colName.get(t.column_id) ?? '',
      description: htmlToPlainText(t.description),
      due_date: t.due_date ?? '',
      created_at: formatDateTime(t.created_at),
      updated_at: formatDateTime(t.updated_at),
      components_count: list.length,
      components_summary: componentSummary(list),
    };
  });
}

export function buildComponentRows(
  tasks: Task[],
  components: TaskComponent[],
  profiles: Map<string, Profile>,
): ComponentRow[] {
  const byTask = groupByTask(components);
  const name = (id: string) => {
    const p = profiles.get(id);
    return p?.full_name || p?.email || id;
  };
  const rows: ComponentRow[] = [];
  for (const t of tasks) {
    for (const c of byTask.get(t.id) ?? []) {
      rows.push({
        task_id: t.id,
        task_title: t.title,
        component_type: displayTypeName(c),
        metadata_type: c.component_type.metadata_type ?? '',
        component_name: c.component_name,
        intervention: interventionLabel(c.intervention_type),
        work_detail: c.work_detail_plain,
        created_by: name(c.created_by),
        created_at: formatDateTime(c.created_at),
        updated_by: name(c.updated_by),
        updated_at: formatDateTime(c.updated_at),
      });
    }
  }
  return rows;
}

export interface PdfTaskSection {
  title: string;
  meta: string;
  description: string;
  components: string[][]; // filas: tipo, nombre, intervención, detalle
}

export const PDF_COMPONENT_HEAD = ['Tipo', 'Nombre (API Name)', 'Intervención', 'Detalle'];

export function buildPdfSections(tasks: Task[], columns: BoardColumn[], components: TaskComponent[]): PdfTaskSection[] {
  const colName = new Map(columns.map((c) => [c.id, c.name]));
  const byTask = groupByTask(components);
  return tasks.map((t) => ({
    title: t.title,
    meta: `Columna: ${colName.get(t.column_id) ?? '—'} · Actualizada: ${formatDateTime(t.updated_at)}`,
    description: htmlToPlainText(t.description),
    components: (byTask.get(t.id) ?? []).map((c) => [
      displayTypeName(c),
      c.component_name,
      interventionLabel(c.intervention_type),
      c.work_detail_plain,
    ]),
  }));
}
