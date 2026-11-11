import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { errorMessage } from '../../lib/errors';
import { countComponentsByTask } from '../components/api';
import { ExportMenu } from '../export/ExportMenu';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { createTask, getBoard, updateTask, type Board, type BoardColumn, type Task } from './api';

export function BoardPage() {
  const { boardId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const openTaskId = params.get('task');
  const { user } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [componentCounts, setComponentCounts] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [newTitles, setNewTitles] = useState<Record<string, string>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const refreshCounts = useCallback(async (ids: string[]) => {
    try {
      setComponentCounts(await countComponentsByTask(ids));
    } catch {
      /* el conteo es informativo; no bloquea el tablero */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await getBoard(boardId);
      setBoard(r.board);
      setColumns(r.columns);
      setTasks(r.tasks);
      void refreshCounts(r.tasks.map((t) => t.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [boardId, refreshCounts]);

  useEffect(() => {
    void load();
  }, [load]);

  const addTask = async (e: FormEvent, columnId: string) => {
    e.preventDefault();
    const title = (newTitles[columnId] ?? '').trim();
    if (!title || !user) return;
    try {
      const t = await createTask(boardId, columnId, title, user.id);
      setTasks((ts) => [...ts, t]);
      setNewTitles((n) => ({ ...n, [columnId]: '' }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const moveTask = async (taskId: string, columnId: string) => {
    const prev = tasks;
    if (prev.find((t) => t.id === taskId)?.column_id === columnId) return;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, column_id: columnId } : t)));
    try {
      await updateTask(taskId, { column_id: columnId });
    } catch (err) {
      setTasks(prev);
      setError(errorMessage(err));
    }
  };

  const openTask = (id: string | null) => setParams(id ? { task: id } : {});

  return (
    <main className="page page--wide">
      <header className="board-header">
        <div>
          <nav className="breadcrumb" aria-label="Ruta">
            <Link to="/">Tableros</Link> <span aria-hidden="true">›</span> <span>{board?.name ?? '…'}</span>
          </nav>
          <h1>{board?.name ?? 'Tablero'}</h1>
        </div>
        <ExportMenu boardName={board?.name ?? 'tablero'} tasks={tasks} columns={columns} />
      </header>
      {error && (
        <div className="callout callout--error" role="alert">
          {error}
        </div>
      )}
      <div className="board">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.column_id === col.id);
          return (
            <section
              key={col.id}
              className={`column${dropTarget === col.id ? ' is-drop-target' : ''}`}
              aria-label={col.name}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(col.id);
              }}
              onDragLeave={() => setDropTarget((d) => (d === col.id ? null : d))}
              onDrop={(e) => {
                setDropTarget(null);
                const id = e.dataTransfer.getData('text/task-id');
                if (id) void moveTask(id, col.id);
              }}
            >
              <h2 className="column__title">
                {col.name} <span className="counter">{colTasks.length}</span>
              </h2>
              <ul className="column__tasks">
                {colTasks.map((t) => {
                  const n = componentCounts.get(t.id) ?? 0;
                  return (
                    <li key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/task-id', t.id)}>
                      <button type="button" className="task-card" onClick={() => openTask(t.id)}>
                        <span className="task-card__title">{t.title}</span>
                        {(n > 0 || t.due_date) && (
                          <span className="task-card__meta">
                            {n > 0 && (
                              <span className="pill pill--components" title={`${n} componente(s) Salesforce`}>
                                🧩 {n}
                              </span>
                            )}
                            {t.due_date && <span className="pill">📅 {new Date(`${t.due_date}T00:00`).toLocaleDateString('es-CL')}</span>}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {colTasks.length === 0 && <p className="column__empty">Arrastra tareas aquí</p>}
              <form className="column__add" onSubmit={(e) => void addTask(e, col.id)}>
                <label htmlFor={`new-${col.id}`} className="sr-only">
                  Nueva tarea en {col.name}
                </label>
                <input
                  id={`new-${col.id}`}
                  className="input input--sm"
                  placeholder="+ Nueva tarea (Enter)"
                  value={newTitles[col.id] ?? ''}
                  onChange={(e) => setNewTitles((n) => ({ ...n, [col.id]: e.target.value }))}
                />
              </form>
            </section>
          );
        })}
      </div>

      {openTaskId && (
        <TaskDetailPanel
          taskId={openTaskId}
          columns={columns}
          onClose={() => openTask(null)}
          onTaskChanged={(t) => setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)))}
          onComponentsChanged={() => void refreshCounts(tasks.map((t) => t.id))}
          onTaskDeleted={(id) => {
            setTasks((ts) => ts.filter((x) => x.id !== id));
            openTask(null);
          }}
        />
      )}
    </main>
  );
}
