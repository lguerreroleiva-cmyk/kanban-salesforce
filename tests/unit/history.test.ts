import { describeChanges } from '../../src/features/tasks/TaskHistory';

describe('describeChanges (historial)', () => {
  it('muestra campo, valor anterior y nuevo con etiquetas de UI', () => {
    expect(describeChanges({ intervention_type: { old: 'new', new: 'updated' } })).toEqual([
      { field: 'intervention_type', label: 'Intervención', from: 'Nuevo', to: 'Actualizado' },
    ]);
  });

  it('maneja nulos y cambios marcados sin valores', () => {
    expect(describeChanges({ other_type_note: { old: null, new: 'Bot' }, description: { changed: true } })).toEqual([
      { field: 'other_type_note', label: 'Especificar tipo', from: '(vacío)', to: 'Bot' },
      { field: 'description', label: 'Descripción', from: '', to: 'modificada' },
    ]);
  });

  it('tolera entradas sin cambios', () => {
    expect(describeChanges({})).toEqual([]);
    expect(describeChanges(null)).toEqual([]);
  });
});
