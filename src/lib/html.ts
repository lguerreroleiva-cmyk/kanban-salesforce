import DOMPurify from 'dompurify';

/**
 * Formato del editor enriquecido de la app: HTML generado por Tiptap (StarterKit).
 * Solo se permiten las etiquetas que produce el editor, sin atributos.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 's', 'u', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
];

export function sanitizeHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form'],
  });
}

const BLOCK_END = /<(br|\/p|\/li|\/h[1-6]|\/blockquote|\/pre|\/div)[^>]*>/gi;

/** Texto plano equivalente a public.html_to_plain() (resumen, validación, exportación). */
export function htmlToPlainText(html: string | null | undefined): string {
  const clean = sanitizeHtml(html).replace(BLOCK_END, ' ');
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** `<p></p>`, `<p><br></p>`, espacios o &nbsp; cuentan como vacío. */
export function isHtmlEmpty(html: string | null | undefined): boolean {
  return htmlToPlainText(html) === '';
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
