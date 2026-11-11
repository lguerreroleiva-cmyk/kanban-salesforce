import { useState } from 'react';
import { errorMessage } from '../../lib/errors';
import { listProfiles, type BoardColumn, type Task } from '../boards/api';
import { listComponentsForTasks } from '../components/api';
import { downloadBlob, safeFilename, toCsv } from './csv';
import { buildComponentRows, buildPdfSections, buildTaskRows, COMPONENT_HEADERS, TASK_HEADERS } from './flatten';

interface ExportMenuProps {
  boardName: string;
  tasks: Task[];
  columns: BoardColumn[];
}

type Format = 'csv' | 'xlsx' | 'pdf';

/** Exportación de tareas (CSV, Excel, PDF) incluyendo los componentes de cada tarea. */
export function ExportMenu({ boardName, tasks, columns }: ExportMenuProps) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (format: Format) => {
    setBusy(format);
    setError(null);
    try {
      const [components, profiles] = await Promise.all([
        listComponentsForTasks(tasks.map((t) => t.id)),
        listProfiles(),
      ]);
      const base = `${safeFilename(boardName)}_${new Date().toISOString().slice(0, 10)}`;

      if (format === 'csv') {
        const taskRows = buildTaskRows(tasks, columns, components);
        const compRows = buildComponentRows(tasks, components, profiles);
        downloadBlob(new Blob([toCsv(TASK_HEADERS, taskRows)], { type: 'text/csv;charset=utf-8' }), `${base}_tareas.csv`);
        downloadBlob(
          new Blob([toCsv(COMPONENT_HEADERS, compRows)], { type: 'text/csv;charset=utf-8' }),
          `${base}_componentes.csv`,
        );
      } else if (format === 'xlsx') {
        const { buildWorkbook, workbookToBlob } = await import('./excel');
        const wb = buildWorkbook(buildTaskRows(tasks, columns, components), buildComponentRows(tasks, components, profiles));
        downloadBlob(await workbookToBlob(wb), `${base}.xlsx`);
      } else {
        const { buildPdf } = await import('./pdf');
        buildPdf(boardName, buildPdfSections(tasks, columns, components)).save(`${base}.pdf`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-menu" role="group" aria-label="Exportar tareas">
      {(['csv', 'xlsx', 'pdf'] as Format[]).map((f) => (
        <button key={f} type="button" className="btn btn--sm" disabled={busy !== null || tasks.length === 0} onClick={() => void run(f)}>
          {busy === f ? 'Exportando…' : `Exportar ${f === 'xlsx' ? 'Excel' : f.toUpperCase()}`}
        </button>
      ))}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
