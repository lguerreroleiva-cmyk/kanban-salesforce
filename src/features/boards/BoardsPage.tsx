import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { errorMessage } from '../../lib/errors';
import { createBoard, listBoards, type Board } from './api';

const BOARD_COLORS = [
  'linear-gradient(135deg,#5b4cf0,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#84cc16,#10b981)',
];

export function boardColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BOARD_COLORS[h % BOARD_COLORS.length];
}

export function BoardsPage() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBoards().then(setBoards).catch((e) => setError(errorMessage(e)));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    try {
      const b = await createBoard(name, user.id);
      setBoards((bs) => [...(bs ?? []), b]);
      setName('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Espacio de trabajo</p>
          <h1>Tableros</h1>
          <p className="muted">Organiza tus tareas y registra los componentes Salesforce intervenidos en cada una.</p>
        </div>
      </header>
      {error && (
        <div className="callout callout--error" role="alert">
          {error}
        </div>
      )}
      <form className="new-board" onSubmit={submit}>
        <label htmlFor="board-name" className="sr-only">
          Nombre del tablero
        </label>
        <input
          id="board-name"
          className="input"
          placeholder="Nombre del nuevo tablero (ej.: Proyecto Portal Empresas)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          + Crear tablero
        </button>
      </form>
      {boards === null ? (
        <p className="muted">Cargando tableros…</p>
      ) : boards.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            📋
          </span>
          <p>Aún no tienes tableros. Crea el primero con el campo de arriba.</p>
        </div>
      ) : (
        <ul className="board-list">
          {boards.map((b) => (
            <li key={b.id}>
              <Link className="board-card" to={`/boards/${b.id}`} style={{ '--board-color': boardColor(b.id) } as CSSProperties}>
                <span className="board-card__icon" aria-hidden="true">
                  {b.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="board-card__name">{b.name}</span>
                <span className="board-card__meta">Creado el {new Date(b.created_at).toLocaleDateString('es-CL')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
