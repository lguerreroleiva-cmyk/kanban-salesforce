import { useId, useState } from 'react';
import { RichTextView } from '../../components/RichTextView';
import { truncate } from '../../lib/html';
import { InterventionBadge } from './InterventionBadge';
import { displayTypeName, type TaskComponent } from './types';

interface ComponentItemProps {
  component: TaskComponent;
  onEdit: (c: TaskComponent) => void;
  onDelete: (c: TaskComponent) => void;
}

const SUMMARY_MAX = 140;

export function ComponentItem({ component: c, onEdit, onDelete }: ComponentItemProps) {
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <li className={`component-item component-item--${c.intervention_type}`} data-testid="component-item">
      <div className="component-item__head">
        <button
          type="button"
          className="component-item__toggle"
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="component-item__main">
            <span className="component-item__type">
              {displayTypeName(c)}
              {!c.component_type.is_active && <span className="muted"> (tipo inactivo)</span>}
            </span>
            <span className="component-item__name mono">{c.component_name}</span>
            {!open && (
              <span className="component-item__summary" title={c.work_detail_plain}>
                {truncate(c.work_detail_plain, SUMMARY_MAX)}
              </span>
            )}
          </span>
        </button>
        <InterventionBadge value={c.intervention_type} />
        <div className="component-item__actions">
          <button type="button" className="btn btn--sm" onClick={() => onEdit(c)} aria-label={`Editar ${c.component_name}`}>
            Editar
          </button>
          <button
            type="button"
            className="btn btn--sm btn--danger-ghost"
            onClick={() => onDelete(c)}
            aria-label={`Eliminar ${c.component_name}`}
          >
            Eliminar
          </button>
        </div>
      </div>
      <div id={detailId} hidden={!open} className="component-item__detail">
        {open && <RichTextView html={c.work_detail} />}
        {open && (
          <p className="meta">
            Actualizado el {new Date(c.updated_at).toLocaleString('es-CL')}
          </p>
        )}
      </div>
    </li>
  );
}
