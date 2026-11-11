import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { errorMessage } from '../../lib/errors';
import * as api from './api';
import { ComponentFormModal } from './ComponentFormModal';
import { ComponentItem } from './ComponentItem';
import type { ComponentFormValues, ComponentTypeRef, TaskComponent } from './types';

interface ComponentsSectionProps {
  taskId: string;
  /** Se invoca tras crear/editar/eliminar (p. ej. para refrescar el historial). */
  onChanged?: () => void;
}

export const SECTION_TITLE = 'Componentes desarrollados, actualizados o configurados';

export function ComponentsSection({ taskId, onChanged }: ComponentsSectionProps) {
  const [components, setComponents] = useState<TaskComponent[]>([]);
  const [types, setTypes] = useState<ComponentTypeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskComponent | null>(null);
  const [deleting, setDeleting] = useState<TaskComponent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cs, ts] = await Promise.all([api.listTaskComponents(taskId), api.listComponentTypes()]);
      setComponents(cs);
      setTypes(ts);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSubmit = async (values: ComponentFormValues) => {
    if (editing) {
      const updated = await api.updateTaskComponent(editing.id, values);
      setComponents((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
      setNotice(`Componente «${updated.component_name}» actualizado.`);
    } else {
      const nextOrder = components.reduce((m, c) => Math.max(m, c.sort_order), 0) + 10;
      const created = await api.createTaskComponent(taskId, values, nextOrder);
      setComponents((cs) => [...cs, created]);
      setNotice(`Componente «${created.component_name}» agregado.`);
    }
    setFormOpen(false);
    setEditing(null);
    onChanged?.();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteTaskComponent(deleting.id);
      setComponents((cs) => cs.filter((c) => c.id !== deleting.id));
      setNotice(`Componente «${deleting.component_name}» eliminado.`);
      setDeleting(null);
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <section className="task-section components-section" aria-labelledby="components-title">
      <header className="task-section__header">
        <h3 id="components-title">
          <span className="section-icon section-icon--violet" aria-hidden="true">🧩</span>
          {SECTION_TITLE}{' '}
          <span className="counter" data-testid="components-counter" aria-label={`${components.length} componentes`}>
            {components.length}
          </span>
        </h3>
        {components.length > 0 && (
          <button type="button" className="btn btn--primary btn--sm" onClick={openCreate}>
            + Agregar componente
          </button>
        )}
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>

      {error && (
        <div className="callout callout--error" role="alert">
          {error}{' '}
          <button type="button" className="link" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando componentes…</p>
      ) : components.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">🧩</span>
          <p>Aún no se han registrado componentes Salesforce en esta tarea.</p>
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Agregar componente
          </button>
        </div>
      ) : (
        <ul className="component-list">
          {components.map((c) => (
            <ComponentItem
              key={c.id}
              component={c}
              onEdit={(x) => {
                setEditing(x);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
            />
          ))}
        </ul>
      )}

      {formOpen && (
        <ComponentFormModal
          types={types}
          existing={components}
          editing={editing}
          onSubmit={handleSubmit}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Eliminar componente"
          message={`¿Eliminar «${deleting.component_name}» (${deleting.component_type.name}) de esta tarea? Quedará registrado en el historial.`}
          confirmLabel="Eliminar"
          danger
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
