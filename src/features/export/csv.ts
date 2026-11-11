/** Neutraliza inyección de fórmulas al abrir el CSV en Excel/Sheets. */
export function guardFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: unknown): string {
  const s = guardFormula(value === null || value === undefined ? '' : String(value));
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<K extends string>(
  headers: readonly { key: K; label: string }[],
  rows: Record<K, unknown>[],
): string {
  const lines = [headers.map((h) => csvCell(h.label)).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h.key])).join(','));
  // BOM para que Excel reconozca UTF-8 (tildes y ñ).
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'export';
}
