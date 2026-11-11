import { mapDbError } from '../../src/lib/errors';
import { toSaveError } from '../../src/features/components/api';
import type { ComponentFormValues, ComponentTypeRef } from '../../src/features/components/types';
import { DUPLICATE_MESSAGE, hasErrors, isDirty, validateComponentForm } from '../../src/features/components/validation';

const types: ComponentTypeRef[] = [
  { id: 'lwc', name: 'Lightning Web Component', requires_note: false, is_active: true, metadata_type: 'LightningComponentBundle' },
  { id: 'otro', name: 'Otro', requires_note: true, is_active: true, metadata_type: null },
];

const valid: ComponentFormValues = {
  component_type_id: 'lwc',
  other_type_note: '',
  component_name: 'PortalEmpresa',
  intervention_type: 'new',
  work_detail: '<p>Desarrollo del componente</p>',
};

describe('validateComponentForm', () => {
  it('acepta un formulario válido', () => {
    expect(hasErrors(validateComponentForm(valid, types))).toBe(false);
  });

  it.each<[keyof ComponentFormValues, string]>([
    ['component_type_id', ''],
    ['component_name', ''],
    ['component_name', '   '],
    ['intervention_type', ''],
    ['work_detail', ''],
    ['work_detail', '<p></p>'],
    ['work_detail', '<p><br></p>'],
  ])('marca %s vacío (%j)', (field, value) => {
    const errors = validateComponentForm({ ...valid, [field]: value }, types);
    expect(errors[field]).toBeTruthy();
  });

  it('exige «Especificar tipo» solo para Otro', () => {
    expect(validateComponentForm({ ...valid, component_type_id: 'otro' }, types).other_type_note).toBeTruthy();
    expect(validateComponentForm({ ...valid, component_type_id: 'otro', other_type_note: '  ' }, types).other_type_note).toBeTruthy();
    expect(validateComponentForm({ ...valid, component_type_id: 'otro', other_type_note: 'Bot' }, types).other_type_note).toBeUndefined();
    expect(validateComponentForm({ ...valid, other_type_note: '' }, types).other_type_note).toBeUndefined();
  });

  it('limita el nombre a 255 caracteres tras recortar', () => {
    expect(validateComponentForm({ ...valid, component_name: `  ${'x'.repeat(255)}  ` }, types).component_name).toBeUndefined();
    expect(validateComponentForm({ ...valid, component_name: 'x'.repeat(256) }, types).component_name).toBeTruthy();
  });

  it('detecta duplicados (mismo tipo, sin distinguir mayúsculas ni espacios)', () => {
    const existing = [{ id: 'c1', component_type_id: 'lwc', component_name: 'PortalEmpresa' }];
    const errors = validateComponentForm({ ...valid, component_name: '  portalempresa ' }, types, existing);
    expect(errors.component_name).toBe(DUPLICATE_MESSAGE);
    // al editar el mismo registro no es duplicado
    expect(validateComponentForm(valid, types, existing, 'c1').component_name).toBeUndefined();
    // otro tipo, mismo nombre: permitido
    expect(
      validateComponentForm({ ...valid, component_type_id: 'otro', other_type_note: 'x' }, types, existing).component_name,
    ).toBeUndefined();
  });

  it('isDirty', () => {
    expect(isDirty(valid, { ...valid })).toBe(false);
    expect(isDirty(valid, { ...valid, component_name: 'X' })).toBe(true);
  });
});

describe('mapeo de errores de BD a campos', () => {
  it('usa el HINT field:<columna>', () => {
    const m = mapDbError({ code: '23514', message: 'Debes especificar el tipo', hint: 'field:other_type_note' });
    expect(m.fieldErrors).toEqual({ other_type_note: 'Debes especificar el tipo' });
  });

  it('traduce el índice único a mensaje de duplicado en el nombre', () => {
    const e = toSaveError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "task_components_task_type_name_uniq"',
    });
    expect(e.mapped.fieldErrors.component_name).toBe(DUPLICATE_MESSAGE);
  });

  it('RLS → mensaje de permisos', () => {
    const e = toSaveError({ code: '42501', message: 'new row violates row-level security policy' });
    expect(e.mapped.formError).toMatch(/permisos/);
  });
});
