import ExcelJS from 'exceljs';
import { guardFormula } from './csv';
import { COMPONENT_HEADERS, TASK_HEADERS, type ComponentRow, type TaskRow } from './flatten';

function addSheet<K extends string>(
  wb: ExcelJS.Workbook,
  name: string,
  headers: readonly { key: K; label: string }[],
  rows: Record<K, unknown>[],
) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = headers.map((h) => ({
    header: h.label,
    key: h.key,
    width: h.key.includes('detail') || h.key.includes('description') || h.key.includes('summary') ? 60 : 22,
  }));
  for (const r of rows) {
    const safe: Record<string, unknown> = {};
    for (const h of headers) {
      const v = r[h.key];
      safe[h.key] = typeof v === 'string' ? guardFormula(v) : v;
    }
    ws.addRow(safe);
  }
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  ws.eachRow((row, i) => {
    if (i > 1) row.alignment = { vertical: 'top', wrapText: true };
  });
  return ws;
}

/** Libro con hoja «Tareas» (incluye resumen) y hoja «Componentes» (una fila por componente). */
export function buildWorkbook(taskRows: TaskRow[], componentRows: ComponentRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kanban Salesforce';
  wb.created = new Date();
  addSheet(wb, 'Tareas', TASK_HEADERS, taskRows);
  addSheet(wb, 'Componentes', COMPONENT_HEADERS, componentRows);
  return wb;
}

export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
