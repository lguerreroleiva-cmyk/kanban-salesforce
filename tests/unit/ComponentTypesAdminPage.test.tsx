import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from '../../src/features/components/types';
import { NOW, TYPES } from './fixtures';

let isAdmin = true;
vi.mock('../../src/auth/AuthProvider', () => ({ useAuth: () => ({ isAdmin }) }));

let store: ComponentType[] = [];
let usage = new Map<string, number>();

vi.mock('../../src/features/components/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/features/components/api')>();
  return {
    ...real,
    listComponentTypes: vi.fn(async () => [...store].sort((a, b) => a.sort_order - b.sort_order)),
    getComponentTypeUsage: vi.fn(async () => usage),
    createComponentType: vi.fn(async (input: Partial<ComponentType>) => {
      const t = { ...TYPES[0], ...input, id: `new-${store.length}`, created_at: NOW, updated_at: NOW } as ComponentType;
      store.push(t);
      return t;
    }),
    updateComponentType: vi.fn(async (id: string, patch: Partial<ComponentType>) => {
      store = store.map((t) => (t.id === id ? { ...t, ...patch } : t));
      return store.find((t) => t.id === id)!;
    }),
    deleteComponentType: vi.fn(async (id: string) => {
      store = store.filter((t) => t.id !== id);
    }),
    reorderComponentTypes: vi.fn(async () => {}),
    mergeComponentTypes: vi.fn(async (source: string) => {
      store = store.filter((t) => t.id !== source);
      return 2;
    }),
  };
});

const { ComponentTypesAdminPage, duplicateKey, findLikelyDuplicates } = await import(
  '../../src/features/components/ComponentTypesAdminPage'
);
const api = await import('../../src/features/components/api');

const DUP: ComponentType = { ...TYPES[0], id: 't-dup', name: 'ApexClass', sort_order: 15 };

beforeEach(() => {
  isAdmin = true;
  store = [...TYPES, DUP];
  usage = new Map([['t-lwc', 3], ['t-dup', 2]]);
  vi.clearAllMocks();
});

describe('detección de duplicados', () => {
  it('normaliza mayúsculas, tildes, espacios y signos', () => {
    expect(duplicateKey(' Apex  Class ')).toBe(duplicateKey('apexclass'));
    expect(duplicateKey('Queue / Public Group')).toBe('queuepublicgroup');
    expect(findLikelyDuplicates([{ id: '1', name: 'Apex Class' }, { id: '2', name: 'ApexClass' }, { id: '3', name: 'Flow' }])).toEqual([
      ['Apex Class', 'ApexClass'],
    ]);
  });
});

describe('Mantenedor de tipos de componente', () => {
  it('pide perfil de administrador a quien no lo es', () => {
    isAdmin = false;
    render(<ComponentTypesAdminPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/administrador/i);
    expect(api.listComponentTypes).not.toHaveBeenCalled();
  });

  it('lista tipos con su uso, avisa duplicados y bloquea eliminar los que están en uso', async () => {
    render(<ComponentTypesAdminPage />);
    expect((await screen.findByText(/posibles tipos duplicados/i)).closest('.callout')).toHaveTextContent('«Apex Class» / «ApexClass»');
    expect(screen.getByRole('button', { name: 'Eliminar Lightning Web Component' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Eliminar Apex Class' })).toBeEnabled();
  });

  it('filtra por parte del nombre y por estado', async () => {
    const user = userEvent.setup();
    render(<ComponentTypesAdminPage />);
    await screen.findByText('Lightning Web Component');
    await user.type(screen.getByLabelText('Buscar tipo por nombre'), 'web');
    expect(screen.getAllByRole('row')).toHaveLength(2); // cabecera + 1
    await user.clear(screen.getByLabelText('Buscar tipo por nombre'));
    await user.click(screen.getByRole('button', { name: /inactivos/i }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('S-Control')).toBeInTheDocument();
  });

  it('crea un tipo y rechaza nombres equivalentes a uno existente', async () => {
    const user = userEvent.setup();
    render(<ComponentTypesAdminPage />);
    await screen.findByText('Lightning Web Component');
    await user.click(screen.getByRole('button', { name: '+ Nuevo tipo' }));
    const dialog = screen.getByRole('dialog', { name: 'Nuevo tipo de componente' });
    await user.type(within(dialog).getByLabelText('Nombre *'), 'lightning web component');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Ya existe un tipo equivalente');
    expect(api.createComponentType).not.toHaveBeenCalled();

    await user.clear(within(dialog).getByLabelText('Nombre *'));
    await user.type(within(dialog).getByLabelText('Nombre *'), 'Einstein Bot');
    await user.type(within(dialog).getByLabelText('Tipo en Metadata API'), 'Bot');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.createComponentType).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Einstein Bot', metadata_type: 'Bot', requires_note: false, is_active: true }),
    );
    expect(await screen.findByText('Einstein Bot')).toBeInTheDocument();
  });

  it('edita (renombra) un tipo', async () => {
    const user = userEvent.setup();
    render(<ComponentTypesAdminPage />);
    await user.click(await screen.findByRole('button', { name: 'Editar Apex Class' }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Nombre *'));
    await user.type(within(dialog).getByLabelText('Nombre *'), 'Clase Apex');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.updateComponentType).toHaveBeenCalledWith('t-apex', expect.objectContaining({ name: 'Clase Apex' })));
  });

  it('activa/desactiva con el interruptor', async () => {
    const user = userEvent.setup();
    render(<ComponentTypesAdminPage />);
    await user.click(await screen.findByRole('switch', { name: 'Apex Class activo' }));
    expect(api.updateComponentType).toHaveBeenCalledWith('t-apex', { is_active: false });
  });

  it('fusiona el duplicado en el tipo elegido', async () => {
    const user = userEvent.setup();
    render(<ComponentTypesAdminPage />);
    await user.click(await screen.findByRole('button', { name: 'Fusionar ApexClass' }));
    const dialog = screen.getByRole('dialog', { name: 'Fusionar «ApexClass»' });
    expect(dialog).toHaveTextContent('Los 2 componente(s)');
    await user.type(within(dialog).getByRole('combobox', { name: 'Tipo de destino *' }), 'apex c');
    await user.click(within(dialog).getByRole('option', { name: 'Apex Class' }));
    await user.click(within(dialog).getByRole('button', { name: 'Fusionar y eliminar origen' }));
    await waitFor(() => expect(api.mergeComponentTypes).toHaveBeenCalledWith('t-dup', 't-apex'));
    expect(await screen.findByText('«ApexClass» fusionado en «Apex Class».')).toBeInTheDocument();
    expect(screen.queryByText(/posibles tipos duplicados/i)).not.toBeInTheDocument();
  });

  it('elimina un tipo sin uso tras confirmar', async () => {
    const user = userEvent.setup();
    render(<ComponentTypesAdminPage />);
    await user.click(await screen.findByRole('button', { name: 'Eliminar Apex Class' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(api.deleteComponentType).toHaveBeenCalledWith('t-apex'));
  });
});
