import { useMemo } from 'react';
import { sanitizeHtml } from '../lib/html';

/** Render seguro del HTML del editor: siempre pasa por DOMPurify. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeHtml(html), [html]);
  return <div className={`rich-text ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: safe }} />;
}
