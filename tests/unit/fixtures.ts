import type { BoardColumn, Profile, Task } from '../../src/features/boards/api';
import type { ComponentType, TaskComponent } from '../../src/features/components/types';

export const NOW = '2026-11-10T12:00:00.000Z';

export const TYPES: ComponentType[] = [
  { id: 't-apex', name: 'Apex Class', metadata_type: 'ApexClass', requires_note: false, sort_order: 10, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 't-lwc', name: 'Lightning Web Component', metadata_type: 'LightningComponentBundle', requires_note: false, sort_order: 40, is_active: true, created_at: NOW, updated_at: NOW },
  { id: 't-old', name: 'S-Control', metadata_type: 'Scontrol', requires_note: false, sort_order: 500, is_active: false, created_at: NOW, updated_at: NOW },
  { id: 't-otro', name: 'Otro', metadata_type: null, requires_note: true, sort_order: 999, is_active: true, created_at: NOW, updated_at: NOW },
];

export function makeComponent(over: Partial<TaskComponent> = {}): TaskComponent {
  const type = TYPES.find((t) => t.id === (over.component_type_id ?? 't-lwc'))!;
  return {
    id: 'c-1',
    task_id: 'task-1',
    component_type_id: type.id,
    component_name: 'PortalEmpresa',
    other_type_note: null,
    intervention_type: 'new',
    work_detail: '<p>Desarrollo del componente para capturar solicitudes</p>',
    work_detail_plain: 'Desarrollo del componente para capturar solicitudes',
    sort_order: 10,
    created_by: 'u-1',
    updated_by: 'u-1',
    created_at: NOW,
    updated_at: NOW,
    component_type: {
      id: type.id, name: type.name, requires_note: type.requires_note, is_active: type.is_active, metadata_type: type.metadata_type,
    },
    ...over,
  };
}

export const COLUMNS: BoardColumn[] = [
  { id: 'col-1', board_id: 'b-1', name: 'Por hacer', position: 0, created_at: NOW },
  { id: 'col-2', board_id: 'b-1', name: 'Hecho', position: 1, created_at: NOW },
];

export const TASKS: Task[] = [
  {
    id: 'task-1', board_id: 'b-1', column_id: 'col-1', title: 'Portal empresas', description: '<p>Desc <strong>1</strong></p>',
    position: 0, assignee_id: null, due_date: null, created_by: 'u-1', created_at: NOW, updated_at: NOW,
  },
  {
    id: 'task-2', board_id: 'b-1', column_id: 'col-2', title: 'Sin componentes', description: '',
    position: 1, assignee_id: null, due_date: '2026-12-01', created_by: 'u-1', created_at: NOW, updated_at: NOW,
  },
];

export const PROFILES = new Map<string, Profile>([
  ['u-1', { id: 'u-1', email: 'ana@example.test', full_name: 'Ana Pérez', app_role: 'member', created_at: NOW, updated_at: NOW }],
]);
