import { interventionLabel } from './types';

const ICONS: Record<string, string> = { new: '＋', updated: '↻', configured: '⚙' };

/** Badge con color + icono + texto (no depende solo del color). */
export function InterventionBadge({ value }: { value: string }) {
  return (
    <span className={`badge badge--${value}`} data-testid="intervention-badge">
      <span aria-hidden="true">{ICONS[value] ?? '•'}</span> {interventionLabel(value)}
    </span>
  );
}
