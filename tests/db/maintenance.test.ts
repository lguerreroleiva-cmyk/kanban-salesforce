/** Mantenedor del catálogo: uso por tipo y fusión de tipos duplicados. */
import type { PGlite } from '@electric-sql/pglite';
import { asSuper, asUser, createBoardWithTask, createDb, createUser, expectPgError, typeId } from './harness';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';

async function addComponent(db: PGlite, taskId: string, typeIdValue: string, name: string) {
  await db.query(
    `insert into public.task_components (task_id, component_type_id, component_name, intervention_type, work_detail)
     values ($1, $2, $3, 'new', '<p>x</p>')`,
    [taskId, typeIdValue, name],
  );
}

describe('mantenedor de tipos (BD)', () => {
  let db: PGlite;
  let taskA: string;
  let taskB: string;
  let dupId: string;
  let apex: string;

  beforeAll(async () => {
    db = await createDb();
    await createUser(db, A, 'a@example.test');
    await createUser(db, B, 'b@example.test');
    await createUser(db, ADMIN, 'admin@example.test', true);
    ({ taskId: taskA } = await createBoardWithTask(db, A, 'Tarea A'));
    ({ taskId: taskB } = await createBoardWithTask(db, B, 'Tarea B'));
    await asSuper(db);
    apex = await typeId(db, 'Apex Class');
    await asUser(db, ADMIN);
    const r = await db.query<{ id: string }>(
      `insert into public.component_types (name, metadata_type) values ('Clase Apex', 'ApexClass') returning id`);
    dupId = r.rows[0].id;
    // componentes en tableros de distintos usuarios (el admin no es miembro de ninguno)
    await asUser(db, A);
    await addComponent(db, taskA, dupId, 'AccountService');
    await addComponent(db, taskA, dupId, 'ContactService');
    await asUser(db, B);
    await addComponent(db, taskB, dupId, 'LeadService');
  });

  afterEach(async () => asSuper(db));

  it('component_type_usage cuenta el uso en todas las tareas (solo admin)', async () => {
    await asUser(db, ADMIN);
    const r = await db.query<{ component_type_id: string; usage_count: number }>(
      'select component_type_id, usage_count::int as usage_count from public.component_type_usage()');
    const byId = new Map(r.rows.map((x) => [x.component_type_id, x.usage_count]));
    expect(byId.get(dupId)).toBe(3);
    expect(byId.get(apex)).toBe(0);

    await asUser(db, A);
    const err = await expectPgError(db.query('select * from public.component_type_usage()'));
    expect(err.code).toBe('42501');
  });

  it('un no-administrador no puede fusionar', async () => {
    await asUser(db, A);
    const err = await expectPgError(db.query('select public.merge_component_types($1, $2)', [dupId, apex]));
    expect(err.code).toBe('42501');
  });

  it('rechaza fusionar un tipo consigo mismo o hacia un tipo inactivo', async () => {
    await asUser(db, ADMIN);
    const same = await expectPgError(db.query('select public.merge_component_types($1, $1)', [dupId]));
    expect(same.hint).toBe('field:target');
    const flow = await typeId(db, 'Flow');
    await db.query('update public.component_types set is_active = false where id = $1', [flow]);
    const inactive = await expectPgError(db.query('select public.merge_component_types($1, $2)', [dupId, flow]));
    expect(inactive.hint).toBe('field:target');
    await db.query('update public.component_types set is_active = true where id = $1', [flow]);
  });

  it('rechaza la fusión si una tarea quedaría con el componente repetido', async () => {
    await asUser(db, A);
    await addComponent(db, taskA, apex, 'accountservice');
    await asUser(db, ADMIN);
    const err = await expectPgError(db.query('select public.merge_component_types($1, $2)', [dupId, apex]));
    expect(err.code).toBe('23505');
    expect(err.message).toContain('1 tarea(s)');
    // nada cambió
    await asSuper(db);
    const r = await db.query<{ n: number }>(
      'select count(*)::int as n from public.task_components where component_type_id = $1', [dupId]);
    expect(r.rows[0].n).toBe(3);
    await asUser(db, A);
    await db.query(`delete from public.task_components where task_id = $1 and component_name = 'accountservice'`, [taskA]);
  });

  it('fusiona: mueve componentes de todas las tareas, registra historial y elimina el duplicado', async () => {
    await asUser(db, ADMIN);
    const r = await db.query<{ moved: number }>('select public.merge_component_types($1, $2) as moved', [dupId, apex]);
    expect(r.rows[0].moved).toBe(3);

    await asSuper(db);
    const left = await db.query('select 1 from public.component_types where id = $1', [dupId]);
    expect(left.rows).toHaveLength(0);
    const moved = await db.query<{ n: number }>(
      'select count(*)::int as n from public.task_components where component_type_id = $1', [apex]);
    expect(moved.rows[0].n).toBe(3);

    const h = await db.query<{ actor_id: string; changes: unknown }>(
      `select actor_id, changes from public.task_history
        where task_id = $1 and entity = 'component' and action = 'updated'`, [taskB]);
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0].actor_id).toBe(ADMIN);
    expect(h.rows[0].changes).toEqual({ component_type: { old: 'Clase Apex', new: 'Apex Class' } });
  });
});
