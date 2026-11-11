import { useEffect, useState } from 'react';
import { errorMessage } from '../../lib/errors';
import { truncate } from '../../lib/html';
import { listHistory, listProfiles, profileName, type HistoryEntry, type Profile } from '../boards/api';
import { interventionLabel } from '../components/types';

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  column_id: 'Columna',
  assignee_id: 'Responsable',
  due_date: 'Fecha límite',
  component_type: 'Tipo',
  component_name: 'Nombre',
  other_type_note: 'Especificar tipo',
  intervention_type: 'Intervención',
  work_detail: 'Detalle',
  sort_order: 'Orden',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'creó',
  updated: 'editó',
  deleted: 'eliminó',
  moved: 'movió',
};

type Change = { old?: unknown; new?: unknown; changed?: boolean };

export function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '(vacío)';
  if (field === 'intervention_type') return interventionLabel(String(v));
  return truncate(String(v), 160);
}

export function describeChanges(changes: unknown): { field: string; label: string; from: string; to: string }[] {
  if (!changes || typeof changes !== 'object') return [];
  return Object.entries(changes as Record<string, Change>).map(([field, c]) => ({
    field,
    label: FIELD_LABELS[field] ?? field,
    from: c?.changed ? '' : formatValue(field, c?.old),
    to: c?.changed ? 'modificada' : formatValue(field, c?.new),
  }));
}

export function TaskHistory({ taskId, refreshKey }: { taskId: string; refreshKey: number }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listHistory(taskId), listProfiles()])
      .then(([h, p]) => {
        if (!alive) return;
        setEntries(h);
        setProfiles(p);
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [taskId, refreshKey]);

  return (
    <section className="task-section" aria-labelledby="history-title">
      <header className="task-section__header">
        <h3 id="history-title">Historial</h3>
      </header>
      {error && <p className="alert alert--error">{error}</p>}
      {entries.length === 0 ? (
        <p className="muted">Sin movimientos.</p>
      ) : (
        <ol className="history">
          {entries.map((e) => {
            const diffs = describeChanges(e.changes);
            return (
              <li key={e.id} className={`history__item history__item--${e.entity}`}>
                <div>
                  <strong>{profileName(profiles, e.actor_id)}</strong> {ACTION_LABELS[e.action] ?? e.action}{' '}
                  {e.entity === 'component' ? 'un componente' : 'la tarea'}
                  {' · '}
                  <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString('es-CL')}</time>
                </div>
                {e.summary && <div className="muted">{e.summary}</div>}
                {diffs.length > 0 && (
                  <ul className="history__diff">
                    {diffs.map((d) => (
                      <li key={d.field}>
                        <span className="history__field">{d.label}:</span>{' '}
                        {d.from && (
                          <>
                            <del>{d.from}</del> →{' '}
                          </>
                        )}
                        <ins>{d.to}</ins>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
