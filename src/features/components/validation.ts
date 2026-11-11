import { isHtmlEmpty } from '../../lib/html';
import type { ComponentField, ComponentFormValues, ComponentTypeRef, TaskComponent } from './types';
import { INTERVENTION_TYPES } from './types';

export type FieldErrors = Partial<Record<ComponentField, string>>;

export const MAX_NAME = 255;
export const MAX_NOTE = 255;

export const DUPLICATE_MESSAGE = 'Este componente ya está registrado en la tarea con el mismo tipo.';

export function normalizeName(name: string): string {
  return name.trim();
}

/** Validación de cliente; la BD aplica las mismas reglas (ver task_components_before_write). */
export function validateComponentForm(
  values: ComponentFormValues,
  types: ComponentTypeRef[],
  existing: Pick<TaskComponent, 'id' | 'component_type_id' | 'component_name'>[] = [],
  editingId?: string,
): FieldErrors {
  const errors: FieldErrors = {};
  const type = types.find((t) => t.id === values.component_type_id);

  if (!values.component_type_id || !type) {
    errors.component_type_id = 'Selecciona el tipo de componente.';
  }

  if (type?.requires_note) {
    const note = values.other_type_note.trim();
    if (!note) errors.other_type_note = 'Especifica el tipo de componente.';
    else if (note.length > MAX_NOTE) errors.other_type_note = `Máximo ${MAX_NOTE} caracteres.`;
  }

  const name = normalizeName(values.component_name);
  if (!name) errors.component_name = 'El nombre (API Name) es obligatorio.';
  else if (name.length > MAX_NAME) errors.component_name = `Máximo ${MAX_NAME} caracteres.`;

  if (!values.intervention_type || !INTERVENTION_TYPES.includes(values.intervention_type)) {
    errors.intervention_type = 'Selecciona el tipo de intervención.';
  }

  if (isHtmlEmpty(values.work_detail)) {
    errors.work_detail = 'Describe el trabajo realizado.';
  }

  if (!errors.component_name && !errors.component_type_id) {
    const dup = existing.some(
      (c) =>
        c.id !== editingId &&
        c.component_type_id === values.component_type_id &&
        c.component_name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (dup) errors.component_name = DUPLICATE_MESSAGE;
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function isDirty(a: ComponentFormValues, b: ComponentFormValues): boolean {
  return (Object.keys(a) as ComponentField[]).some((k) => (a[k] ?? '') !== (b[k] ?? ''));
}
