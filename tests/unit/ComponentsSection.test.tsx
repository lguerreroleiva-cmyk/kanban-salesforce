import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentFormValues, TaskComponent } from '../../src/features/components/types';
import { makeComponent, NOW, TYPES } from './fixtures';

// ---------------------------------------------------------------- mocks
// Editor enriquecido → textarea (Tiptap no es necesario para probar la lógica de la sección).
vi.mock('../../src/components/RichTextEditor', () => ({
  RichTextEditor: (p: { id?: string; value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <textarea id={p.id} aria-label={p.ariaLabel} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
  ),
}));

// "Backend" en memoria que simula persistencia y las respuestas de la BD.
const db: { rows: TaskComponent[] } = { rows: [] };
let seq = 100;

vi.mock('../../src/features/components/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/features/components/api')>();
  const build = (taskId: string, v: ComponentFormValues, id: string, prev?: TaskComponent): TaskComponent => {
    const t = TYPES.find((x) => x.id === v.component_type_id)!;
    return makeComponent({
      ...(prev ?? {}),
      id,
      task_id: taskId,
      component_type_id: t.id,
      component_name: v.component_name.trim(),
      other_type_note: t.requires_note ? v.other_type_note.trim() : null,
      intervention_type: v.intervention_type,
      work_detail: v.work_detail,
      work_detail_plain: v.work_detail.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      updated_at: NOW,
      component_type: { id: t.id, name: t.name, requires_note: t.requires_note, is_active: t.is_active, metadata_type: t.metadata_type },
    });
  };
  return {
    ...real,
    listComponentTypes: vi.fn(async () => TYPES.filter((t) => t.is_active)),
    listTaskComponents: vi.fn(async (taskId: string) => db.rows.filter((r) => r.task_id === taskId)),
    createTaskComponent: vi.fn(async (taskId: string, v: ComponentFormValues) => {
      const dup = db.rows.some(
        (r) => r.task_id === taskId && r.component_type_id === v.component_type_id &&
          r.component_name.toLowerCase() === v.component_name.trim().toLowerCase(),
      );
      if (dup) {
        throw real.toSaveError({
          code: '23505',
          message: 'duplicate key value violates unique constraint "task_components_task_type_name_uniq"',
        });
      }
      const row = build(taskId, v, `c-${seq++}`);
      db.rows.push(row);
      return row;
    }),
    updateTaskComponent: vi.fn(async (id: string, v: ComponentFormValues) => {
      const i = db.rows.findIndex((r) => r.id === id);
      db.rows[i] = build(db.rows[i].task_id, v, id, db.rows[i]);
      return db.rows[i];
    }),
    deleteTaskComponent: vi.fn(async (id: string) => {
      db.rows = db.rows.filter((r) => r.id !== id);
    }),
  };
});

const { ComponentsSection } = await import('../../src/features/components/ComponentsSection');
const api = await import('../../src/features/components/api');

const DETAIL =
  'Desarrollo del componente para capturar solicitudes, validar los campos del formulario y comunicarse con los métodos Apex correspondientes';

beforeEach(() => {
  db.rows = [];
  vi.clearAllMocks();
});

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /agregar componente/i }));
  return screen.findByRole('dialog', { name: /agregar componente/i });
}

async function pickType(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: string) {
  const input = within(dialog).getByRole('combobox', { name: 'Tipo de componente *' });
  await user.clear(input);
  await user.type(input, name);
  await user.click(within(dialog).getByRole('option', { name }));
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  v: { type: string; name: string; intervention: string; detail: string; note?: string },
) {
  await pickType(user, dialog, v.type);
  if (v.note !== undefined) await user.type(within(dialog).getByLabelText('Especificar tipo *'), v.note);
  await user.type(within(dialog).getByLabelText('Nombre (API Name) *'), v.name);
  await user.click(within(dialog).getByRole('radio', { name: v.intervention }));
  await user.type(within(dialog).getByLabelText('Detalle del trabajo realizado'), v.detail);
}

describe('ComponentsSection', () => {
  it('muestra el estado vacío con llamada a la acción y contador 0', async () => {
    render(<ComponentsSection taskId="task-1" />);
    expect(await screen.findByText(/aún no se han registrado componentes/i)).toBeInTheDocument();
    expect(screen.getByTestId('components-counter')).toHaveTextContent('0');
    expect(screen.getByRole('heading', { name: /componentes desarrollados, actualizados o configurados/i })).toBeInTheDocument();
  });

  it('criterio 1: registra PortalEmpresa, muestra badge «Nuevo», aumenta el contador y persiste al recargar', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const { unmount } = render(<ComponentsSection taskId="task-1" onChanged={onChanged} />);
    const dialog = await openForm(user);
    await fillForm(user, dialog, {
      type: 'Lightning Web Component', name: 'PortalEmpresa', intervention: 'Nuevo', detail: DETAIL,
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const item = screen.getByTestId('component-item');
    expect(within(item).getByText('PortalEmpresa')).toBeInTheDocument();
    expect(within(item).getByTestId('intervention-badge')).toHaveTextContent('Nuevo');
    expect(within(item).getByText(/Desarrollo del componente/)).toBeInTheDocument();
    expect(screen.getByTestId('components-counter')).toHaveTextContent('1');
    expect(onChanged).toHaveBeenCalled();

    // "recargar"
    unmount();
    render(<ComponentsSection taskId="task-1" />);
    expect(await screen.findByText('PortalEmpresa')).toBeInTheDocument();
    expect(screen.getByTestId('components-counter')).toHaveTextContent('1');
  });

  it('valida cada campo obligatorio con mensajes por campo y no llama a la API', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Selecciona el tipo de componente.')).toBeInTheDocument();
    expect(screen.getByText('El nombre (API Name) es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('Selecciona el tipo de intervención.')).toBeInTheDocument();
    expect(screen.getByText('Describe el trabajo realizado.')).toBeInTheDocument();
    expect(api.createTaskComponent).not.toHaveBeenCalled();
  });

  it('detalle vacío del editor (<p></p>) cuenta como vacío', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    await fillForm(user, dialog, { type: 'Apex Class', name: 'Svc', intervention: 'Actualizado', detail: '<p></p>' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Describe el trabajo realizado.')).toBeInTheDocument();
    expect(api.createTaskComponent).not.toHaveBeenCalled();
  });

  it('«Especificar tipo» solo aparece y es obligatorio con Otro', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    expect(within(dialog).queryByLabelText('Especificar tipo *')).not.toBeInTheDocument();
    await pickType(user, dialog, 'Otro');
    expect(within(dialog).getByLabelText('Especificar tipo *')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Nombre (API Name) *'), 'X');
    await user.click(within(dialog).getByRole('radio', { name: 'Configurado' }));
    await user.type(within(dialog).getByLabelText('Detalle del trabajo realizado'), 'algo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Especifica el tipo de componente.')).toBeInTheDocument();
  });

  it('un solo campo de tipo: filtra por parte del nombre (LIKE) y no ofrece inactivos', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    expect(within(dialog).queryByLabelText(/buscar tipo/i)).not.toBeInTheDocument();
    const input = within(dialog).getByRole('combobox', { name: 'Tipo de componente *' });
    await user.type(input, 'web');
    expect(within(dialog).getAllByRole('option').map((o) => o.textContent)).toEqual(['Lightning Web Component']);
    await user.clear(input);
    await user.type(input, 's-con');
    expect(within(dialog).queryAllByRole('option')).toHaveLength(0);
    expect(within(dialog).getByText(/sin coincidencias/i)).toBeInTheDocument();
  });

  it('recorta espacios del nombre antes de guardar', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    await fillForm(user, dialog, { type: 'Apex Class', name: '   AccountService   ', intervention: 'Nuevo', detail: 'x' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.createTaskComponent).toHaveBeenCalled());
    const values = vi.mocked(api.createTaskComponent).mock.calls[0][1];
    expect(values.component_name).toBe('AccountService');
  });

  it('mensaje específico si el componente ya existe (validación de cliente)', async () => {
    db.rows = [makeComponent()];
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    await fillForm(user, dialog, {
      type: 'Lightning Web Component', name: 'portalempresa', intervention: 'Nuevo', detail: 'x',
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/ya está registrado en la tarea/)).toBeInTheDocument();
    expect(api.createTaskComponent).not.toHaveBeenCalled();
  });

  it('mensaje específico si la BD rechaza el duplicado (carrera entre usuarios)', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    // otro usuario lo registró mientras el formulario estaba abierto
    db.rows = [makeComponent()];
    await fillForm(user, dialog, {
      type: 'Lightning Web Component', name: 'PortalEmpresa', intervention: 'Nuevo', detail: 'x',
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/ya está registrado en la tarea/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /agregar componente/i })).toBeInTheDocument();
  });

  it('criterio 2 (UI): edita la intervención a «Actualizado»', async () => {
    db.rows = [makeComponent()];
    const user = userEvent.setup();
    const onChanged = vi.fn();
    render(<ComponentsSection taskId="task-1" onChanged={onChanged} />);
    await user.click(await screen.findByRole('button', { name: 'Editar PortalEmpresa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar componente' });
    expect(within(dialog).getByLabelText('Nombre (API Name) *')).toHaveValue('PortalEmpresa');
    await user.click(within(dialog).getByRole('radio', { name: 'Actualizado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByTestId('intervention-badge')).toHaveTextContent('Actualizado'));
    expect(vi.mocked(api.updateTaskComponent).mock.calls[0][1].intervention_type).toBe('updated');
    expect(onChanged).toHaveBeenCalled();
  });

  it('elimina con confirmación', async () => {
    db.rows = [makeComponent()];
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar PortalEmpresa' }));
    const confirm = await screen.findByRole('dialog', { name: 'Eliminar componente' });
    expect(api.deleteTaskComponent).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.getByTestId('components-counter')).toHaveTextContent('0'));
    expect(api.deleteTaskComponent).toHaveBeenCalledWith('c-1');
  });

  it('cancelar la eliminación no borra nada', async () => {
    db.rows = [makeComponent()];
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar PortalEmpresa' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(api.deleteTaskComponent).not.toHaveBeenCalled();
    expect(screen.getByTestId('components-counter')).toHaveTextContent('1');
  });

  it('avisa al cancelar con cambios sin guardar', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Nombre (API Name) *'), 'Algo');
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    const warn = await screen.findByRole('dialog', { name: 'Descartar cambios' });
    await user.click(within(warn).getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByRole('dialog', { name: /agregar componente/i })).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog', { name: /agregar componente/i })).getByRole('button', { name: 'Cancelar' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Descartar cambios' })).getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('cancelar sin cambios cierra directamente', async () => {
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const dialog = await openForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('expande y contrae el detalle enriquecido', async () => {
    db.rows = [makeComponent({ work_detail: '<p>Detalle <strong>completo</strong></p>' })];
    const user = userEvent.setup();
    render(<ComponentsSection taskId="task-1" />);
    const toggle = await screen.findByRole('button', { expanded: false });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('completo').tagName).toBe('STRONG');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('XSS: el detalle con <script> o handlers inline no se ejecuta al renderizar', async () => {
    const w = window as unknown as { __xss?: number };
    delete w.__xss;
    db.rows = [
      makeComponent({
        work_detail:
          '<p>ok</p><script>window.__xss = 1</script><img src="x" onerror="window.__xss = 2"><p onclick="window.__xss=3">clic</p>',
      }),
    ];
    const user = userEvent.setup();
    const { container } = render(<ComponentsSection taskId="task-1" />);
    await user.click(await screen.findByRole('button', { expanded: false }));
    await user.click(screen.getByText('clic'));
    await new Promise((r) => setTimeout(r, 50));
    expect(w.__xss).toBeUndefined();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
  });

  it('muestra los tipos inactivos en registros existentes', async () => {
    db.rows = [
      makeComponent({
        component_type_id: 't-old',
        component_name: 'LegacyCtrl',
        component_type: { id: 't-old', name: 'S-Control', requires_note: false, is_active: false, metadata_type: 'Scontrol' },
      }),
    ];
    render(<ComponentsSection taskId="task-1" />);
    expect(await screen.findByText('S-Control')).toBeInTheDocument();
    expect(screen.getByText('(tipo inactivo)')).toBeInTheDocument();
  });
});
