import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { filterTypes, TypeSelect } from '../../src/features/components/TypeSelect';
import { TYPES } from './fixtures';

describe('filterTypes (equivalente a ILIKE %texto%)', () => {
  it('coincide en cualquier parte del nombre, sin mayúsculas', () => {
    expect(filterTypes(TYPES, 'CLASS').map((t) => t.name)).toEqual(['Apex Class']);
    expect(filterTypes(TYPES, 'web').map((t) => t.name)).toEqual(['Lightning Web Component']);
  });

  it('ignora tildes y espacios extremos', () => {
    const types = [{ ...TYPES[0], id: 'x', name: 'Configuración' }];
    expect(filterTypes(types, '  configuracion ')).toHaveLength(1);
  });

  it('prioriza las coincidencias al inicio del nombre', () => {
    const types = [
      { ...TYPES[0], id: '1', name: 'Custom Flow Action' },
      { ...TYPES[0], id: '2', name: 'Flow' },
    ];
    expect(filterTypes(types, 'flow').map((t) => t.name)).toEqual(['Flow', 'Custom Flow Action']);
  });

  it('sin texto devuelve todo', () => {
    expect(filterTypes(TYPES, '')).toHaveLength(TYPES.length);
  });
});

function Harness({ initial = '' }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <label htmlFor="t">Tipo</label>
      <TypeSelect id="t" types={TYPES} value={v} onChange={setV} />
      <output data-testid="value">{v}</output>
      <button type="button">otro foco</button>
    </>
  );
}

describe('TypeSelect (combobox)', () => {
  it('se navega con el teclado y Enter selecciona', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Tipo' });
    await user.type(input, 'o'); // coincidencias: «Otro» (al inicio) y «Lightning Web Component»
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByTestId('value').textContent).toBe('t-lwc');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('muestra el nombre del tipo seleccionado y lo restaura si el texto no coincide', async () => {
    const user = userEvent.setup();
    render(<Harness initial="t-lwc" />);
    const input = screen.getByRole('combobox', { name: 'Tipo' });
    expect(input).toHaveValue('Lightning Web Component');
    await user.clear(input);
    await user.type(input, 'zzz');
    await user.click(screen.getByRole('button', { name: 'otro foco' }));
    expect(input).toHaveValue('Lightning Web Component');
    expect(screen.getByTestId('value').textContent).toBe('t-lwc');
  });

  it('acepta el nombre escrito completo aunque no se haga clic', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox', { name: 'Tipo' });
    await user.type(input, 'apex class');
    await user.click(screen.getByRole('button', { name: 'otro foco' }));
    expect(screen.getByTestId('value').textContent).toBe('t-apex');
    expect(input).toHaveValue('Apex Class');
  });

  it('Escape cierra la lista sin cerrar el modal contenedor', async () => {
    const user = userEvent.setup();
    const onKey = vi.fn();
    render(
      <div onKeyDown={onKey}>
        <Harness />
      </div>,
    );
    const input = screen.getByRole('combobox', { name: 'Tipo' });
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    onKey.mockClear();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onKey).not.toHaveBeenCalled();
  });
});
