import ExcelJS from 'exceljs';
import { csvCell, toCsv } from '../../src/features/export/csv';
import { buildWorkbook } from '../../src/features/export/excel';
import {
  buildComponentRows, buildPdfSections, buildTaskRows, COMPONENT_HEADERS, TASK_HEADERS,
} from '../../src/features/export/flatten';
import { COLUMNS, makeComponent, PROFILES, TASKS } from './fixtures';

const components = [
  makeComponent(),
  makeComponent({
    id: 'c-2', component_type_id: 't-otro', component_name: 'MiBot', other_type_note: 'Einstein Bot',
    intervention_type: 'configured', work_detail_plain: 'Configuración, con "comillas"\ny salto', sort_order: 20,
    component_type: { id: 't-otro', name: 'Otro', requires_note: true, is_active: true, metadata_type: null },
  }),
];

describe('aplanado de exportación', () => {
  it('tareas: columna resumen y conteo por tarea', () => {
    const rows = buildTaskRows(TASKS, COLUMNS, components);
    expect(rows[0]).toMatchObject({
      task_id: 'task-1',
      column: 'Por hacer',
      description: 'Desc 1',
      components_count: 2,
      components_summary: 'Lightning Web Component: PortalEmpresa (Nuevo); Otro (Einstein Bot): MiBot (Configurado)',
    });
    expect(rows[1]).toMatchObject({ task_id: 'task-2', components_count: 0, components_summary: '' });
  });

  it('componentes: una fila por componente con datos de la tarea y autoría', () => {
    const rows = buildComponentRows(TASKS, components, PROFILES);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      task_id: 'task-1',
      task_title: 'Portal empresas',
      component_type: 'Lightning Web Component',
      metadata_type: 'LightningComponentBundle',
      component_name: 'PortalEmpresa',
      intervention: 'Nuevo',
      work_detail: 'Desarrollo del componente para capturar solicitudes',
      created_by: 'Ana Pérez',
    });
    expect(rows[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(rows[1].component_type).toBe('Otro (Einstein Bot)');
  });

  it('PDF: subsección de componentes dentro de cada tarea', () => {
    const sections = buildPdfSections(TASKS, COLUMNS, components);
    expect(sections[0].components).toEqual([
      ['Lightning Web Component', 'PortalEmpresa', 'Nuevo', 'Desarrollo del componente para capturar solicitudes'],
      ['Otro (Einstein Bot)', 'MiBot', 'Configurado', 'Configuración, con "comillas"\ny salto'],
    ]);
    expect(sections[1].components).toEqual([]);
  });
});

describe('CSV', () => {
  it('escapa comillas, comas y saltos de línea', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
  });

  it('neutraliza inyección de fórmulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM')).toBe("'@SUM");
  });

  it('genera cabecera + filas con BOM', () => {
    const csv = toCsv(COMPONENT_HEADERS, buildComponentRows(TASKS, components, PROFILES));
    expect(csv.startsWith('﻿ID tarea,Título de tarea,Tipo,')).toBe(true);
    expect(csv.trim().split('\r\n')).toHaveLength(3);
    expect(csv).toContain('PortalEmpresa');
  });
});

describe('Excel', () => {
  it('incluye hoja Tareas con resumen y hoja Componentes con una fila por componente', async () => {
    const wb = buildWorkbook(buildTaskRows(TASKS, COLUMNS, components), buildComponentRows(TASKS, components, PROFILES));
    const buffer = await wb.xlsx.writeBuffer();

    const read = new ExcelJS.Workbook();
    await read.xlsx.load(buffer as ArrayBuffer);
    const tasks = read.getWorksheet('Tareas')!;
    const comps = read.getWorksheet('Componentes')!;

    expect(tasks.getRow(1).getCell(TASK_HEADERS.length).value).toBe('Componentes (resumen)');
    expect(tasks.rowCount).toBe(3);
    expect(String(tasks.getRow(2).getCell(TASK_HEADERS.length).value)).toContain('PortalEmpresa');

    expect(comps.rowCount).toBe(3);
    expect(comps.getRow(1).values).toEqual([undefined, ...COMPONENT_HEADERS.map((h) => h.label)]);
    expect(comps.getRow(2).getCell(5).value).toBe('PortalEmpresa');
    expect(comps.getRow(3).getCell(6).value).toBe('Configurado');
  });
});
