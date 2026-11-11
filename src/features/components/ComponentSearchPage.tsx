import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../lib/errors';
import { truncate } from '../../lib/html';
import { searchComponents, type ComponentSearchResult } from './api';
import { InterventionBadge } from './InterventionBadge';

/** Consulta entre tareas: ¿en qué tareas se intervino un componente? */
export function ComponentSearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<ComponentSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await searchComponents(q));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial) void run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setParams(query.trim() ? { q: query.trim() } : {});
    void run(query);
  };

  const taskCount = results ? new Set(results.map((r) => r.task_id)).size : 0;

  return (
    <main className="page">
      <h1>Buscar componente entre tareas</h1>
      <form className="search-bar" onSubmit={submit} role="search">
        <label htmlFor="component-search" className="sr-only">
          Nombre del componente
        </label>
        <input
          id="component-search"
          type="search"
          className="input mono"
          placeholder="Ej.: PortalEmpresa"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      {results && (
        <p role="status" className="muted">
          {results.length === 0
            ? 'No se encontraron componentes con ese nombre en las tareas a las que tienes acceso.'
            : `${results.length} registro(s) en ${taskCount} tarea(s).`}
        </p>
      )}

      {results && results.length > 0 && (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Componente</th>
                <th scope="col">Tipo</th>
                <th scope="col">Tarea</th>
                <th scope="col">Tablero</th>
                <th scope="col">Intervención</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.component_id}>
                  <td data-label="Componente" className="mono" title={r.work_detail_plain}>
                    {r.component_name}
                    <div className="muted small">{truncate(r.work_detail_plain, 90)}</div>
                  </td>
                  <td data-label="Tipo">{r.component_type_name}</td>
                  <td data-label="Tarea">
                    <Link to={`/boards/${r.board_id}?task=${r.task_id}`}>{r.task_title}</Link>
                  </td>
                  <td data-label="Tablero">{r.board_name}</td>
                  <td data-label="Intervención">
                    <InterventionBadge value={r.intervention_type} />
                  </td>
                  <td data-label="Fecha">
                    <time dateTime={r.updated_at}>{new Date(r.updated_at).toLocaleDateString('es-CL')}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
