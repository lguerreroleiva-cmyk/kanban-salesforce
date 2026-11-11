import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RichTextEditor } from '../../components/RichTextEditor';
import { errorMessage } from '../../lib/errors';
import { sanitizeHtml } from '../../lib/html';
import { deleteTask, getTask, updateTask, type BoardColumn, type Task } from '../boards/api';
import { ComponentsSection } from '../components/ComponentsSection';
import { TaskHistory } from './TaskHistory';

interface TaskDetailPanelProps {
  taskId: string;
  columns: BoardColumn[];
  onClose: () => void;
  onTaskChanged: (t: Task) => void;
  onTaskDeleted: (id: string) => void;
}

/** Panel lateral (pantalla completa en móvil) con el detalle de la tarea. */
export function TaskDetailPanel({ taskId, columns, onClose, onTaskChanged, onTaskDeleted }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getTask(taskId)
      .then((t) => {
        setTask(t);
        setTitle(t.title);
        setDescription(t.description);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [taskId]);

  const refreshHistory = () => setHistoryKey((k) => k + 1);

  const save = async (patch: Partial<Task>) => {
    if (!task) return;
    setSaving(true);
    setError(null);
    try {
      const t = await updateTask(task.id, patch);
      setTask(t);
      onTaskChanged(t);
      refreshHistory();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const descriptionDirty = task ? description !== task.description : false;

  return (
    <div className="panel-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de la tarea"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <header className="panel__header">
          <button type="button" className="icon-btn" aria-label="Cerrar detalle" onClick={onClose}>
            ←
          </button>
          <span className="muted">Detalle de la tarea</span>
          {task && (
            <button type="button" className="btn btn--sm btn--danger-ghost" onClick={() => setConfirmDelete(true)}>
              Eliminar tarea
            </button>
          )}
        </header>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {!task ? (
          <p className="muted">Cargando…</p>
        ) : (
          <div className="panel__body">
            <label htmlFor="task-title" className="sr-only">
              Título
            </label>
            <input
              id="task-title"
              className="input input--title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title.trim() !== task.title && void save({ title: title.trim() })}
            />

            <div className="field field--inline">
              <label htmlFor="task-column">Columna</label>
              <select
                id="task-column"
                className="input input--sm"
                value={task.column_id}
                onChange={(e) => void save({ column_id: e.target.value })}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <section className="task-section" aria-labelledby="desc-title">
              <header className="task-section__header">
                <h3 id="desc-title">Descripción</h3>
                {descriptionDirty && (
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    disabled={saving}
                    onClick={() => void save({ description: sanitizeHtml(description) })}
                  >
                    Guardar descripción
                  </button>
                )}
              </header>
              <RichTextEditor value={description} onChange={setDescription} ariaLabel="Descripción de la tarea" />
            </section>

            {/* Sección independiente: los componentes NO se guardan en la descripción. */}
            <ComponentsSection taskId={task.id} onChanged={refreshHistory} />

            <TaskHistory taskId={task.id} refreshKey={historyKey} />
          </div>
        )}
      </aside>

      {confirmDelete && task && (
        <ConfirmDialog
          title="Eliminar tarea"
          message={`¿Eliminar «${task.title}»? Se eliminarán también sus componentes registrados.`}
          confirmLabel="Eliminar"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            deleteTask(task.id)
              .then(() => onTaskDeleted(task.id))
              .catch((e) => setError(errorMessage(e)));
          }}
        />
      )}
    </div>
  );
}
