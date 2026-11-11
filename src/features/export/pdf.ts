import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_COMPONENT_HEAD, type PdfTaskSection } from './flatten';

/** PDF con una sección por tarea y subsección «Componentes…» dentro de cada una. */
export function buildPdf(boardName: string, sections: PdfTaskSection[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFontSize(16);
  doc.text(`Tablero: ${boardName}`, margin, y);
  y += 24;

  for (const s of sections) {
    ensure(60);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(s.title, width), margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(s.meta, margin, y);
    y += 14;
    if (s.description) {
      const lines = doc.splitTextToSize(s.description, width) as string[];
      ensure(lines.length * 11);
      doc.setFontSize(10);
      doc.text(lines, margin, y);
      y += lines.length * 11 + 6;
    }

    ensure(30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Componentes desarrollados, actualizados o configurados (${s.components.length})`, margin, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
    if (s.components.length === 0) {
      y += 10;
      doc.setFontSize(9);
      doc.text('Sin componentes registrados.', margin, y);
      y += 18;
    } else {
      autoTable(doc, {
        startY: y,
        head: [PDF_COMPONENT_HEAD],
        body: s.components,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [30, 64, 175] },
        columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 110 }, 2: { cellWidth: 65 } },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    }
  }
  return doc;
}
