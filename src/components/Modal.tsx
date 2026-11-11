import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** En móvil el modal ocupa toda la pantalla. */
  size?: 'sm' | 'md' | 'lg';
}

/** Modal accesible: foco inicial, Escape para cerrar, aria-modal. */
export function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    return () => previous?.focus?.();
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
