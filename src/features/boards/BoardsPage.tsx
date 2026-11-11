import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { errorMessage } from '../../lib/errors';
import { createBoard, listBoards, type Board } from './api';

export function BoardsPage() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
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
      setBoards((bs) => [...bs, b]);
      setName('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <main className="page">
      <h1>Tableros</h1>
      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}
      <form className="inline-form" onSubmit={submit}>
        <label htmlFor="board-name" className="sr-only">
          Nombre del tablero
        </label>
        <input id="board-name" className="input" placeholder="Nuevo tablero" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn--primary">
          Crear
        </button>
      </form>
      <ul className="board-list">
        {boards.map((b) => (
          <li key={b.id}>
            <Link className="card board-card" to={`/boards/${b.id}`}>
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
