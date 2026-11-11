import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { errorMessage } from '../../lib/errors';
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
  const [error, setError] = useState<string | null>(null);
  const [newTitles, setNewTitles] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await getBoard(boardId);
      setBoard(r.board);
      setColumns(r.columns);
      setTasks(r.tasks);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [boardId]);

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
      <div className="board-header">
        <h1>{board?.name ?? 'Tablero'}</h1>
        <ExportMenu boardName={board?.name ?? 'tablero'} tasks={tasks} columns={columns} />
      </div>
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}
      <div className="board">
        {columns.map((col) => (
          <section
            key={col.id}
            className="column"
            aria-label={col.name}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/task-id');
              if (id) void moveTask(id, col.id);
            }}
          >
            <h2 className="column__title">
              {col.name} <span className="counter">{tasks.filter((t) => t.column_id === col.id).length}</span>
            </h2>
            <ul className="column__tasks">
              {tasks
                .filter((t) => t.column_id === col.id)
                .map((t) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/task-id', t.id)}
                  >
                    <button type="button" className="task-card" onClick={() => openTask(t.id)}>
                      {t.title}
                    </button>
                  </li>
                ))}
            </ul>
            <form className="column__add" onSubmit={(e) => void addTask(e, col.id)}>
              <label htmlFor={`new-${col.id}`} className="sr-only">
                Nueva tarea en {col.name}
              </label>
              <input
                id={`new-${col.id}`}
                className="input input--sm"
                placeholder="+ Nueva tarea"
                value={newTitles[col.id] ?? ''}
                onChange={(e) => setNewTitles((n) => ({ ...n, [col.id]: e.target.value }))}
              />
            </form>
          </section>
        ))}
      </div>

      {openTaskId && (
        <TaskDetailPanel
          taskId={openTaskId}
          columns={columns}
          onClose={() => openTask(null)}
          onTaskChanged={(t) => setTasks((ts) => ts.map((x) => (x.id === t.id ? t : x)))}
          onTaskDeleted={(id) => {
            setTasks((ts) => ts.filter((x) => x.id !== id));
            openTask(null);
          }}
        />
      )}
    </main>
  );
}
