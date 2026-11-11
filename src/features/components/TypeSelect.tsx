import { useMemo, useState } from 'react';
import type { ComponentTypeRef } from './types';

interface TypeSelectProps {
  id: string;
  types: ComponentTypeRef[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

/**
 * Selector de tipo con búsqueda. Muestra solo tipos activos (ya ordenados por sort_order);
 * si el registro editado usa un tipo inactivo, se mantiene visible y marcado.
 */
export function TypeSelect({ id, types, value, onChange, invalid, describedBy }: TypeSelectProps) {
  const [filter, setFilter] = useState('');

  const options = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const visible = types.filter((t) => t.is_active || t.id === value);
    if (!f) return visible;
    return visible.filter(
      (t) => t.id === value || t.name.toLowerCase().includes(f) || (t.metadata_type ?? '').toLowerCase().includes(f),
    );
  }, [types, filter, value]);

  return (
    <div className="type-select">
      <input
        type="search"
        className="input input--sm"
        placeholder="Buscar tipo…"
        aria-label="Buscar tipo de componente"
        aria-controls={id}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required="true"
      >
        <option value="">— Selecciona un tipo —</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.metadata_type ? ` · ${t.metadata_type}` : ''}
            {!t.is_active ? ' (inactivo)' : ''}
          </option>
        ))}
      </select>
      {filter && options.length === 0 && <p className="hint">Sin coincidencias para «{filter}».</p>}
    </div>
  );
}
