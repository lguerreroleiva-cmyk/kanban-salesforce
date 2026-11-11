import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ComponentTypeRef } from './types';

interface TypeSelectProps {
  id: string;
  types: ComponentTypeRef[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

/** Normaliza para comparar sin mayúsculas ni tildes. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Filtro equivalente a `name ILIKE '%texto%'`: coincide en cualquier parte del nombre,
 * sin distinguir mayúsculas ni tildes. Las coincidencias al inicio se muestran primero.
 */
export function filterTypes(types: ComponentTypeRef[], text: string): ComponentTypeRef[] {
  const q = norm(text.trim());
  if (!q) return types;
  const hits = types.filter((t) => norm(t.name).includes(q));
  return [...hits.filter((t) => norm(t.name).startsWith(q)), ...hits.filter((t) => !norm(t.name).startsWith(q))];
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = norm(query.trim());
  const i = q ? norm(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * Campo único de tipo de componente (combobox accesible, patrón ARIA 1.2):
 * se escribe parte del nombre y la lista se filtra; ↑/↓ para moverse, Enter para elegir, Esc para cerrar.
 * Solo ofrece tipos activos; si el registro editado usa uno inactivo, se mantiene visible y marcado.
 */
export function TypeSelect({ id, types, value, onChange, invalid, describedBy }: TypeSelectProps) {
  const listId = useId();
  const selected = types.find((t) => t.id === value);
  const [text, setText] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // Si el valor cambia desde fuera (reset/edición), refleja el nombre.
  useEffect(() => {
    if (!typing) setText(selected?.name ?? '');
  }, [selected?.name, typing]);

  const available = useMemo(() => types.filter((t) => t.is_active || t.id === value), [types, value]);
  const options = useMemo(() => filterTypes(available, typing ? text : ''), [available, text, typing]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  const choose = (t: ComponentTypeRef) => {
    onChange(t.id);
    setText(t.name);
    setTyping(false);
    setOpen(false);
  };

  const closeAndRestore = () => {
    setOpen(false);
    setTyping(false);
    // Texto que no corresponde a un tipo elegido: si coincide exacto, se toma; si no, se limpia la selección.
    const exact = available.find((t) => norm(t.name) === norm(text.trim()));
    if (exact) {
      if (exact.id !== value) onChange(exact.id);
      setText(exact.name);
    } else if (text.trim() === '') {
      if (value) onChange('');
    } else {
      setText(selected?.name ?? '');
    }
  };

  return (
    <div className={`combo${open ? ' is-open' : ''}`}>
      <div className="combo__control">
        <span className="combo__icon" aria-hidden="true">
          🔍
        </span>
        <input
          id={id}
          type="text"
          className="input combo__input"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required="true"
          autoComplete="off"
          placeholder="Escribe para buscar: apex, flow, lightning…"
          value={text}
          onFocus={(e) => {
            e.target.select();
            setOpen(true);
            setActive(Math.max(0, options.findIndex((t) => t.id === value)));
          }}
          onChange={(e) => {
            setText(e.target.value);
            setTyping(true);
            setOpen(true);
            setActive(0);
          }}
          onBlur={closeAndRestore}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              if (open && options[active]) {
                e.preventDefault();
                choose(options[active]);
              }
            } else if (e.key === 'Escape' && open) {
              e.stopPropagation();
              closeAndRestore();
            }
          }}
        />
        {value && (
          <span className="combo__check" aria-hidden="true">
            ✓
          </span>
        )}
      </div>
      {open && (
        <ul id={listId} ref={listRef} className="combo__list" role="listbox" aria-label="Tipos de componente">
          {options.length === 0 ? (
            <li className="combo__empty" role="presentation">
              Sin coincidencias para «{text.trim()}»
            </li>
          ) : (
            options.map((t, i) => (
              <li
                key={t.id}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-label={t.is_active ? t.name : `${t.name} (inactivo)`}
                aria-selected={t.id === value}
                className={`combo__option${i === active ? ' is-active' : ''}${t.id === value ? ' is-selected' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(t)}
              >
                <span>
                  <Highlight text={t.name} query={typing ? text : ''} />
                  {!t.is_active && <span className="muted"> (inactivo)</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
