import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { errorMessage } from '../../lib/errors';
import * as api from './api';
import { filterTypes, TypeSelect } from './TypeSelect';
import type { ComponentType } from './types';

type StatusFilter = 'all' | 'active' | 'inactive';

interface TypeDraft {
  name: string;
  metadata_type: string;
  requires_note: boolean;
  is_active: boolean;
}

/** Clave para detectar duplicados probables: sin mayúsculas, tildes, espacios ni signos. */
export function duplicateKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findLikelyDuplicates(types: Pick<ComponentType, 'id' | 'name'>[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const t of types) {
    const k = duplicateKey(t.name);
    groups.set(k, [...(groups.get(k) ?? []), t.name]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** Mantenedor del catálogo: crear, editar, reordenar, activar/desactivar, eliminar y fusionar. */
export function ComponentTypesAdminPage() {
  const { isAdmin } = useAuth();
  const [types, setTypes] = useState<ComponentType[]>([]);
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ComponentType | 'new' | null>(null);
  const [merging, setMerging] = useState<ComponentType | null>(null);
  const [toDelete, setToDelete] = useState<ComponentType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ts, us] = await Promise.all([api.listComponentTypes({ includeInactive: true }), api.getComponentTypeUsage()]);
      setTypes(ts);
      setUsage(us);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [load, isAdmin]);

  const visible = useMemo(() => {
    const byStatus = types.filter((t) => (status === 'all' ? true : status === 'active' ? t.is_active : !t.is_active));
    return search.trim() ? filterTypes(byStatus, search) as ComponentType[] : byStatus;
  }, [types, status, search]);

  const duplicates = useMemo(() => findLikelyDuplicates(types), [types]);
  const canReorder = !search.trim() && status === 'all';

  if (!isAdmin) {
    return (
      <main className="page">
        <PageHeader />
        <div className="callout callout--warn" role="alert">
          <strong>Necesitas perfil de administrador.</strong> Pide a un administrador que ejecute en Supabase:
          <code className="block">update public.profiles set app_role = 'admin' where email = 'tu-correo';</code>
          y vuelve a iniciar sesión.
        </div>
      </main>
    );
  }

  const act = async (fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    setError(null);
    setNotice(null);
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

  const saveType = async (draft: TypeDraft): Promise<boolean> => {
    const payload = {
      name: draft.name.trim(),
      metadata_type: draft.metadata_type.trim() || null,
      requires_note: draft.requires_note,
      is_active: draft.is_active,
    };
    if (editing === 'new') {
      const maxOrder = types.reduce((m, t) => Math.max(m, t.sort_order), 0);
      return act(() => api.createComponentType({ ...payload, sort_order: maxOrder + 10 }), `Tipo «${payload.name}» creado.`);
    }
    if (editing) return act(() => api.updateComponentType(editing.id, payload), `Tipo «${payload.name}» actualizado.`);
    return false;
  };

  const counts = {
    all: types.length,
    active: types.filter((t) => t.is_active).length,
    inactive: types.filter((t) => !t.is_active).length,
  };

  return (
    <main className="page">
      <PageHeader onCreate={() => setEditing('new')} />

      <div role="status" aria-live="polite">
        {notice && <div className="callout callout--ok">{notice}</div>}
      </div>
      {error && (
        <div className="callout callout--error" role="alert">
          {error}
        </div>
      )}
      {duplicates.length > 0 && (
        <div className="callout callout--warn">
          <strong>Posibles tipos duplicados:</strong>{' '}
          {duplicates.map((g) => g.map((n) => `«${n}»`).join(' / ')).join(' · ')}. Usa <em>Fusionar</em> para unificarlos
          sin perder los componentes registrados.
        </div>
      )}

      <div className="toolbar">
        <div className="search-input">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            className="input"
            aria-label="Buscar tipo por nombre"
            placeholder="Buscar por nombre (contiene)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chips" role="group" aria-label="Filtrar por estado">
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`chip${status === s ? ' is-on' : ''}`}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'Todos' : s === 'active' ? 'Activos' : 'Inactivos'} <span className="chip__n">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>
      {!canReorder && <p className="hint">Para reordenar, limpia la búsqueda y muestra «Todos».</p>}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : visible.length === 0 ? (
        <div className="empty-state">No hay tipos que coincidan.</div>
      ) : (
        <div className="table-wrap card card--flush">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Orden</th>
                <th scope="col">Nombre</th>
                <th scope="col">Metadata API</th>
                <th scope="col">En uso</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const i = types.findIndex((x) => x.id === t.id);
                const used = usage.get(t.id) ?? 0;
                return (
                  <tr key={t.id} className={t.is_active ? '' : 'is-inactive'}>
                    <td data-label="Orden" className="nowrap">
                      <button type="button" className="icon-btn" aria-label={`Subir ${t.name}`} onClick={() => move(i, -1)} disabled={!canReorder || i === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Bajar ${t.name}`}
                        onClick={() => move(i, 1)}
                        disabled={!canReorder || i === types.length - 1}
                      >
                        ↓
                      </button>
                    </td>
                    <td data-label="Nombre">
                      <strong>{t.name}</strong>
                      {t.requires_note && <span className="tag tag--violet">requiere especificar</span>}
                    </td>
                    <td data-label="Metadata API" className="mono muted">
                      {t.metadata_type ?? '—'}
                    </td>
                    <td data-label="En uso">
                      <span className={`tag ${used ? 'tag--blue' : 'tag--gray'}`}>{used}</span>
                    </td>
                    <td data-label="Estado">
                      <label className="switch">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={t.is_active}
                          aria-label={`${t.name} activo`}
                          onChange={() =>
                            void act(
                              () => api.updateComponentType(t.id, { is_active: !t.is_active }),
                              t.is_active ? `«${t.name}» desactivado.` : `«${t.name}» activado.`,
                            )
                          }
                        />
                        <span className="switch__track" aria-hidden="true" />
                        <span className="switch__label">{t.is_active ? 'Activo' : 'Inactivo'}</span>
                      </label>
                    </td>
                    <td data-label="Acciones" className="actions">
                      <button type="button" className="btn btn--sm" onClick={() => setEditing(t)} aria-label={`Editar ${t.name}`}>
                        ✏️ Editar
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => setMerging(t)} aria-label={`Fusionar ${t.name}`}>
                        🔀 Fusionar
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger-ghost"
                        onClick={() => setToDelete(t)}
                        disabled={used > 0}
                        title={used > 0 ? 'En uso: desactívalo o fusiónalo con otro tipo' : undefined}
                        aria-label={`Eliminar ${t.name}`}
                      >
                        🗑️ Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TypeFormModal
          initial={editing === 'new' ? null : editing}
          existing={types}
          onClose={() => setEditing(null)}
          onSave={async (d) => {
            const ok = await saveType(d);
            if (ok) setEditing(null);
            return ok;
          }}
        />
      )}

      {merging && (
        <MergeModal
          source={merging}
          types={types}
          usage={usage.get(merging.id) ?? 0}
          onClose={() => setMerging(null)}
          onMerge={async (targetId) => {
            const target = types.find((t) => t.id === targetId);
            const ok = await act(
              () => api.mergeComponentTypes(merging.id, targetId),
              `«${merging.name}» fusionado en «${target?.name}».`,
            );
            if (ok) setMerging(null);
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar tipo"
          message={`¿Eliminar «${toDelete.name}» del catálogo? Esta acción no se puede deshacer.`}
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

function PageHeader({ onCreate }: { onCreate?: () => void }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Configuración</p>
        <h1>Mantenedor de tipos de componente</h1>
        <p className="muted">
          Catálogo usado al registrar componentes en las tareas. Los tipos en uso no se eliminan: se desactivan o se
          fusionan con otro.
        </p>
      </div>
      {onCreate && (
        <button type="button" className="btn btn--primary" onClick={onCreate}>
          + Nuevo tipo
        </button>
      )}
    </header>
  );
}

function TypeFormModal({
  initial, existing, onClose, onSave,
}: {
  initial: ComponentType | null;
  existing: ComponentType[];
  onClose: () => void;
  onSave: (d: TypeDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<TypeDraft>({
    name: initial?.name ?? '',
    metadata_type: initial?.metadata_type ?? '',
    requires_note: initial?.requires_note ?? false,
    is_active: initial?.is_active ?? true,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return setNameError('El nombre es obligatorio.');
    const clash = existing.find((t) => t.id !== initial?.id && duplicateKey(t.name) === duplicateKey(name));
    if (clash) return setNameError(`Ya existe un tipo equivalente: «${clash.name}».`);
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <Modal
      title={initial ? `Editar «${initial.name}»` : 'Nuevo tipo de componente'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="type-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="type-form" className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="tf-name">Nombre *</label>
          <input
            id="tf-name"
            className="input"
            maxLength={100}
            value={draft.name}
            aria-invalid={!!nameError || undefined}
            aria-describedby={nameError ? 'tf-name-error' : undefined}
            onChange={(e) => {
              setDraft({ ...draft, name: e.target.value });
              setNameError(null);
            }}
            placeholder="Ej.: Einstein Bot"
          />
          {nameError && (
            <p id="tf-name-error" className="field-error" role="alert">
              {nameError}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="tf-meta">Tipo en Metadata API</label>
          <input
            id="tf-meta"
            className="input mono"
            maxLength={120}
            value={draft.metadata_type}
            onChange={(e) => setDraft({ ...draft, metadata_type: e.target.value })}
            placeholder="Ej.: Bot"
          />
          <p className="hint">Opcional. Se usará más adelante para generar package.xml.</p>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={draft.requires_note} onChange={(e) => setDraft({ ...draft, requires_note: e.target.checked })} />
          Pedir «Especificar tipo» al registrar (como «Otro»)
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
          Activo (disponible para nuevos registros)
        </label>
      </form>
    </Modal>
  );
}

function MergeModal({
  source, types, usage, onClose, onMerge,
}: {
  source: ComponentType;
  types: ComponentType[];
  usage: number;
  onClose: () => void;
  onMerge: (targetId: string) => Promise<void>;
}) {
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const candidates = types.filter((t) => t.id !== source.id && t.is_active);
  const targetName = candidates.find((t) => t.id === target)?.name;

  return (
    <Modal
      title={`Fusionar «${source.name}»`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={!target || busy}
            onClick={async () => {
              setBusy(true);
              await onMerge(target);
              setBusy(false);
            }}
          >
            {busy ? 'Fusionando…' : 'Fusionar y eliminar origen'}
          </button>
        </>
      }
    >
      <div className="form">
        <p>
          Los <strong>{usage}</strong> componente(s) registrados como «{source.name}» pasarán al tipo de destino y
          «{source.name}» se eliminará del catálogo. El cambio queda en el historial de cada tarea.
        </p>
        <div className="field">
          <label htmlFor="merge-target">Tipo de destino *</label>
          <TypeSelect id="merge-target" types={candidates} value={target} onChange={setTarget} />
        </div>
        {targetName && (
          <div className="callout callout--warn">
            «{source.name}» → «{targetName}». Esta acción no se puede deshacer.
          </div>
        )}
      </div>
    </Modal>
  );
}
