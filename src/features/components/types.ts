import type { Tables } from '../../lib/database.types';

export type InterventionType = 'new' | 'updated' | 'configured';

export const INTERVENTION_TYPES: InterventionType[] = ['new', 'updated', 'configured'];

export const INTERVENTION_LABELS: Record<InterventionType, string> = {
  new: 'Nuevo',
  updated: 'Actualizado',
  configured: 'Configurado',
};

export function interventionLabel(value: string): string {
  return INTERVENTION_LABELS[value as InterventionType] ?? value;
}

export type ComponentType = Tables<'component_types'>;

export type ComponentTypeRef = Pick<ComponentType, 'id' | 'name' | 'requires_note' | 'is_active' | 'metadata_type'>;

export type TaskComponent = Tables<'task_components'> & {
  component_type: ComponentTypeRef;
};

export interface ComponentFormValues {
  component_type_id: string;
  other_type_note: string;
  component_name: string;
  intervention_type: InterventionType | '';
  work_detail: string;
}

export type ComponentField = keyof ComponentFormValues;

export const EMPTY_FORM: ComponentFormValues = {
  component_type_id: '',
  other_type_note: '',
  component_name: '',
  intervention_type: '',
  work_detail: '',
};

export function toFormValues(c: TaskComponent): ComponentFormValues {
  return {
    component_type_id: c.component_type_id,
    other_type_note: c.other_type_note ?? '',
    component_name: c.component_name,
    intervention_type: c.intervention_type as InterventionType,
    work_detail: c.work_detail,
  };
}

/** Nombre a mostrar del tipo: «Otro (Einstein Bot)». */
export function displayTypeName(c: Pick<TaskComponent, 'component_type' | 'other_type_note'>): string {
  return c.component_type.requires_note && c.other_type_note
    ? `${c.component_type.name} (${c.other_type_note})`
    : c.component_type.name;
}
