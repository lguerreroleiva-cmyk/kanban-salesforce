import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const migrationsDir = join(root, 'supabase/migrations');

export const ROLLBACK_SQL = readFileSync(
  join(root, 'supabase/rollback/20261110000000_task_components_down.sql'),
  'utf8',
);

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
}

export async function createDb(opts: { upTo?: string } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, 'supabase-shim.sql'), 'utf8'));
  for (const file of migrationFiles()) {
    if (opts.upTo && file > opts.upTo) break;
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    await db.query('insert into supabase_migrations.schema_migrations(version) values ($1)', [file.slice(0, 14)]);
  }
  return db;
}

/** Ejecuta como usuario autenticado (rol authenticated + auth.uid()). */
export async function asUser(db: PGlite, userId: string): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
}

/** Vuelve al superusuario (equivalente a service_role / migraciones). */
export async function asSuper(db: PGlite): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}

export async function createUser(db: PGlite, id: string, email: string, admin = false): Promise<string> {
  await asSuper(db);
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  if (admin) await db.query(`update public.profiles set app_role = 'admin' where id = $1`, [id]);
  return id;
}

/** Crea un tablero + tarea como el usuario dado. Devuelve ids. */
export async function createBoardWithTask(db: PGlite, userId: string, title = 'Tarea demo') {
  await asUser(db, userId);
  const board = await db.query<{ id: string }>(`insert into public.boards (name) values ('Tablero') returning id`);
  const boardId = board.rows[0].id;
  const col = await db.query<{ id: string }>(
    `select id from public.board_columns where board_id = $1 order by position limit 1`, [boardId]);
  const task = await db.query<{ id: string }>(
    `insert into public.tasks (board_id, column_id, title) values ($1, $2, $3) returning id`,
    [boardId, col.rows[0].id, title]);
  return { boardId, columnId: col.rows[0].id, taskId: task.rows[0].id };
}

export async function typeId(db: PGlite, name: string): Promise<string> {
  const r = await db.query<{ id: string }>(`select id from public.component_types where name = $1`, [name]);
  if (!r.rows[0]) throw new Error(`Tipo no encontrado: ${name}`);
  return r.rows[0].id;
}

export async function expectPgError(p: Promise<unknown>): Promise<{ message: string; code?: string; hint?: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { message: string; code?: string; hint?: string };
    return err;
  }
  throw new Error('Se esperaba un error de PostgreSQL y la operación tuvo éxito');
}
