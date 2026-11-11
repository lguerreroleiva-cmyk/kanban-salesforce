import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { errorMessage } from '../../lib/errors';
import * as api from './api';
import type { ComponentType } from './types';

/** Administración del catálogo: crear, renombrar, reordenar, activar/desactivar. */
export function ComponentTypesAdminPage() {
  const { isAdmin } = useAuth();
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', metadata_type: '' });
  const [newType, setNewType] = useState({ name: '', metadata_type: '', requires_note: false });
  const [toDelete, setToDelete] = useState<ComponentType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTypes(await api.listComponentTypes({ includeInactive: true }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) {
    return (
      <main className="page">
        <h1>Catálogo de tipos de componente</h1>
        <div className="alert alert--error" role="alert">
          Solo los administradores pueden acceder a esta pantalla.
        </div>
      </main>
    );
  }

  const act = async (fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    setError(null);
    try {
      await fn();
      setNotice(ok);
      await load();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      await load();
      return false;
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= types.length) return;
    const next = [...types];
    [next[index], next[target]] = [next[target], next[index]];
    setTypes(next);
    void act(() => api.reorderComponentTypes(next.map((t) => t.id)), 'Orden actualizado.');
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!newType.name.trim()) {
      setError('El nombre del tipo es obligatorio.');
      return;
    }
    const maxOrder = types.reduce((m, t) => Math.max(m, t.sort_order), 0);
    void act(
      () =>
        api.createComponentType({
          name: newType.name.trim(),
          metadata_type: newType.metadata_type.trim() || null,
          requires_note: newType.requires_note,
          sort_order: maxOrder + 10,
        }),
      `Tipo «${newType.name.trim()}» creado.`,
    ).then((ok) => ok && setNewType({ name: '', metadata_type: '', requires_note: false }));
  };

  const saveEdit = (t: ComponentType) => {
    if (!draft.name.trim()) {
      setError('El nombre del tipo es obligatorio.');
      return;
    }
    void act(
      () => api.updateComponentType(t.id, { name: draft.name.trim(), metadata_type: draft.metadata_type.trim() || null }),
      'Tipo actualizado.',
    ).then((ok) => ok && setEditingId(null));
  };

  return (
    <main className="page">
      <h1>Catálogo de tipos de componente</h1>
      <p className="muted">
        Los tipos en uso no se eliminan: se desactivan. Los inactivos no aparecen al registrar nuevos componentes,
        pero se siguen mostrando en los registros existentes.
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <form className="admin-new card" onSubmit={create}>
        <h2 className="h3">Nuevo tipo</h2>
        <div className="admin-new__grid">
          <label>
            Nombre *
            <input
              className="input"
              value={newType.name}
              maxLength={100}
              onChange={(e) => setNewType({ ...newType, name: e.target.value })}
            />
          </label>
          <label>
            Metadata API
            <input
              className="input mono"
              value={newType.metadata_type}
              maxLength={120}
              onChange={(e) => setNewType({ ...newType, metadata_type: e.target.value })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={newType.requires_note}
              onChange={(e) => setNewType({ ...newType, requires_note: e.target.checked })}
            />
            Requiere especificar tipo
          </label>
          <button type="submit" className="btn btn--primary">
            Crear
          </button>
        </div>
      </form>

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Orden</th>
                <th scope="col">Nombre</th>
                <th scope="col">Metadata API</th>
                <th scope="col">Requiere nota</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr key={t.id} className={t.is_active ? '' : 'is-inactive'}>
                  <td data-label="Orden">
                    <button type="button" className="icon-btn" aria-label={`Subir ${t.name}`} onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Bajar ${t.name}`}
                      onClick={() => move(i, 1)}
                      disabled={i === types.length - 1}
                    >
                      ↓
                    </button>
                  </td>
                  <td data-label="Nombre">
                    {editingId === t.id ? (
                      <input
                        className="input input--sm"
                        aria-label="Nombre"
                        value={draft.name}
                        maxLength={100}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    ) : (
                      t.name
                    )}
                  </td>
                  <td data-label="Metadata API" className="mono">
                    {editingId === t.id ? (
                      <input
                        className="input input--sm mono"
                        aria-label="Metadata API"
                        value={draft.metadata_type}
                        maxLength={120}
                        onChange={(e) => setDraft({ ...draft, metadata_type: e.target.value })}
                      />
                    ) : (
                      t.metadata_type ?? '—'
                    )}
                  </td>
                  <td data-label="Requiere nota">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={t.requires_note}
                        onChange={(e) =>
                          void act(() => api.updateComponentType(t.id, { requires_note: e.target.checked }), 'Tipo actualizado.')
                        }
                      />
                      <span className="sr-only">Requiere nota</span>
                    </label>
                  </td>
                  <td data-label="Estado">
                    <span className={`status ${t.is_active ? 'status--on' : 'status--off'}`}>
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td data-label="Acciones" className="actions">
                    {editingId === t.id ? (
                      <>
                        <button type="button" className="btn btn--sm btn--primary" onClick={() => saveEdit(t)}>
                          Guardar
                        </button>
                        <button type="button" className="btn btn--sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => {
                            setEditingId(t.id);
                            setDraft({ name: t.name, metadata_type: t.metadata_type ?? '' });
                          }}
                        >
                          Renombrar
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() =>
                            void act(
                              () => api.updateComponentType(t.id, { is_active: !t.is_active }),
                              t.is_active ? `«${t.name}» desactivado.` : `«${t.name}» activado.`,
                            )
                          }
                        >
                          {t.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button type="button" className="btn btn--sm btn--danger-ghost" onClick={() => setToDelete(t)}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar tipo"
          message={`¿Eliminar «${toDelete.name}»? Solo es posible si ningún componente lo usa; en ese caso, desactívalo.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            const t = toDelete;
            setToDelete(null);
            void act(() => api.deleteComponentType(t.id), `«${t.name}» eliminado.`);
          }}
        />
      )}
    </main>
  );
}
