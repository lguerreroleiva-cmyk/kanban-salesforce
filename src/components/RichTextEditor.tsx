import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { sanitizeHtml } from '../lib/html';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel?: string;
}

/**
 * Editor enriquecido de la app (Tiptap StarterKit). Guarda HTML.
 * Se usa tanto para la descripción de la tarea como para el detalle de componentes.
 */
export function RichTextEditor({ id, value, onChange, invalid, describedBy, ariaLabel }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3, 4] } })],
    content: sanitizeHtml(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: 'rte__content',
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        ...(invalid ? { 'aria-invalid': 'true' } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Sincroniza cambios externos (p. ej. reset del formulario).
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (value !== current) editor.commands.setContent(sanitizeHtml(value), false);
  }, [value, editor]);

  const btn = (label: string, title: string, active: boolean, run: () => void) => (
    <button
      type="button"
      className={`rte__btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );

  return (
    <div className={`rte${invalid ? ' rte--invalid' : ''}`}>
      {editor && (
        <div className="rte__toolbar" role="toolbar" aria-label="Formato">
          {btn('B', 'Negrita', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
          {btn('I', 'Cursiva', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
          {btn('</>', 'Código', editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
          {btn('• Lista', 'Lista con viñetas', editor.isActive('bulletList'), () =>
            editor.chain().focus().toggleBulletList().run())}
          {btn('1. Lista', 'Lista numerada', editor.isActive('orderedList'), () =>
            editor.chain().focus().toggleOrderedList().run())}
          {btn('{ }', 'Bloque de código', editor.isActive('codeBlock'), () =>
            editor.chain().focus().toggleCodeBlock().run())}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
