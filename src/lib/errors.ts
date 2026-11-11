export interface DbErrorLike {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
}

export interface MappedError<F extends string> {
  fieldErrors: Partial<Record<F, string>>;
  formError?: string;
}

/**
 * Traduce errores de PostgREST/PostgreSQL a mensajes por campo.
 * Convención de la BD: validaciones de negocio con HINT = 'field:<columna>'.
 */
export function mapDbError<F extends string>(
  error: DbErrorLike,
  constraintMessages: Record<string, { field?: F; message: string }> = {},
): MappedError<F> {
  const hint = error.hint ?? '';
  const message = error.message ?? 'Error desconocido';

  if (hint.startsWith('field:')) {
    const field = hint.slice('field:'.length) as F;
    return { fieldErrors: { [field]: message } as Partial<Record<F, string>> };
  }

  for (const [constraint, mapped] of Object.entries(constraintMessages)) {
    if (message.includes(constraint) || (error.details ?? '').includes(constraint)) {
      return mapped.field
        ? { fieldErrors: { [mapped.field]: mapped.message } as Partial<Record<F, string>> }
        : { fieldErrors: {}, formError: mapped.message };
    }
  }

  if (error.code === '42501' || /row-level security/i.test(message)) {
    return { fieldErrors: {}, formError: 'No tienes permisos para realizar esta acción.' };
  }
  if (error.code === '23503') {
    return { fieldErrors: {}, formError: 'El registro está referenciado por otros datos y no puede modificarse así.' };
  }
  return { fieldErrors: {}, formError: message };
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}
