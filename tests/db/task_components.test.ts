/**
 * Pruebas de base de datos contra las migraciones reales (PostgreSQL vía PGlite).
 * Cubren CRUD, validaciones, RLS, integridad, historial, XSS y búsqueda entre tareas.
 */
import type { PGlite } from '@electric-sql/pglite';
import {
  ROLLBACK_SQL, asSuper, asUser, createBoardWithTask, createDb, createUser, expectPgError, typeId,
} from './harness';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';

const LWC_DETAIL =
  '<p>Desarrollo del componente para capturar solicitudes, validar los campos del formulario y comunicarse con los métodos Apex correspondientes</p>';

type Row = Record<string, unknown>;

async function insertComponent(db: PGlite, values: Row): Promise<Row> {
  const cols = Object.keys(values);
  const params = cols.map((_, i) => `$${i + 1}`);
  const r = await db.query<Row>(
    `insert into public.task_components (${cols.join(',')}) values (${params.join(',')}) returning *`,
    Object.values(values),
  );
  return r.rows[0];
}

describe('task_components (BD)', () => {
  let db: PGlite;
  let taskA: string;
  let boardA: string;
  let taskB: string;
  let lwc: string;
  let otro: string;
  let apex: string;

  beforeAll(async () => {
    db = await createDb();
    await createUser(db, A, 'a@example.test');
    await createUser(db, B, 'b@example.test');
    await createUser(db, ADMIN, 'admin@example.test', true);
    ({ taskId: taskA, boardId: boardA } = await createBoardWithTask(db, A, 'Portal empresas'));
    ({ taskId: taskB } = await createBoardWithTask(db, B, 'Tarea de B'));
    await asSuper(db);
    lwc = await typeId(db, 'Lightning Web Component');
    otro = await typeId(db, 'Otro');
    apex = await typeId(db, 'Apex Class');
  });

  afterEach(async () => {
    await asSuper(db);
  });

  // ------------------------------------------------------------------ CRUD
  describe('CRUD y criterio de aceptación 1', () => {
    it('crea, deriva texto plano, fija autoría y persiste', async () => {
      await asUser(db, A);
      const row = await insertComponent(db, {
        task_id: taskA,
        component_type_id: lwc,
        component_name: 'PortalEmpresa',
        intervention_type: 'new',
        work_detail: LWC_DETAIL,
        // intentos del cliente de falsear datos derivados/autoría: se ignoran
        work_detail_plain: 'falso',
        created_by: B,
        updated_by: B,
      });
      expect(row.created_by).toBe(A);
      expect(row.updated_by).toBe(A);
      expect(row.work_detail_plain).toBe(
        'Desarrollo del componente para capturar solicitudes, validar los campos del formulario y comunicarse con los métodos Apex correspondientes',
      );

      const count = await db.query<{ n: number }>(
        'select count(*)::int as n from public.task_components where task_id = $1', [taskA]);
      expect(count.rows[0].n).toBe(1);
    });

    it('edita y elimina', async () => {
      await asUser(db, A);
      const row = await insertComponent(db, {
        task_id: taskA, component_type_id: apex, component_name: 'TmpClass',
        intervention_type: 'configured', work_detail: '<p>tmp</p>',
      });
      const upd = await db.query<Row>(
        `update public.task_components set component_name = 'TmpClass2' where id = $1 returning *`, [row.id]);
      expect(upd.rows[0].component_name).toBe('TmpClass2');
      expect(upd.rows[0].created_by).toBe(A);
      const del = await db.query('delete from public.task_components where id = $1', [row.id]);
      expect(del.affectedRows).toBe(1);
    });
  });

  // ------------------------------------------------------------------ validaciones
  describe('validaciones', () => {
    const base = () => ({
      task_id: taskA, component_type_id: apex, component_name: 'ValidClass',
      intervention_type: 'new', work_detail: '<p>ok</p>',
    });

    it.each([
      ['component_name', ''],
      ['component_name', '    '],
    ])('rechaza %s vacío (%j)', async (field, value) => {
      await asUser(db, A);
      const err = await expectPgError(insertComponent(db, { ...base(), [field]: value }));
      expect(err.hint).toBe('field:component_name');
    });

    it('rechaza nombre de más de 255 caracteres', async () => {
      await asUser(db, A);
      const err = await expectPgError(insertComponent(db, { ...base(), component_name: 'x'.repeat(256) }));
      expect(err.hint).toBe('field:component_name');
    });

    it('rechaza tipo nulo', async () => {
      await asUser(db, A);
      const err = await expectPgError(insertComponent(db, { ...base(), component_type_id: null }));
      expect(err.hint).toBe('field:component_type_id');
    });

    it('rechaza intervención vacía o inválida', async () => {
      await asUser(db, A);
      for (const v of [null, '', 'deleted']) {
        const err = await expectPgError(insertComponent(db, { ...base(), intervention_type: v }));
        expect(err.hint).toBe('field:intervention_type');
      }
    });

    it.each(['', '<p></p>', '<p>   </p>', '<p><br></p>', '<p>&nbsp;</p>'])(
      'rechaza detalle vacío del editor: %j', async (html) => {
        await asUser(db, A);
        const err = await expectPgError(insertComponent(db, { ...base(), work_detail: html }));
        expect(err.hint).toBe('field:work_detail');
      });

    it('exige «Especificar tipo» cuando el tipo es Otro', async () => {
      await asUser(db, A);
      const err = await expectPgError(insertComponent(db, {
        ...base(), component_type_id: otro, other_type_note: '   ',
      }));
      expect(err.hint).toBe('field:other_type_note');

      const ok = await insertComponent(db, {
        ...base(), component_type_id: otro, component_name: 'MiOtro', other_type_note: '  Einstein Bot ',
      });
      expect(ok.other_type_note).toBe('Einstein Bot');
    });

    it('descarta la nota si el tipo no la requiere', async () => {
      await asUser(db, A);
      const row = await insertComponent(db, { ...base(), component_name: 'NoteIgnored', other_type_note: 'x' });
      expect(row.other_type_note).toBeNull();
    });

    it('recorta espacios al inicio/fin del nombre', async () => {
      await asUser(db, A);
      const row = await insertComponent(db, { ...base(), component_name: '   AccountService  ' });
      expect(row.component_name).toBe('AccountService');
    });

    it('impide duplicar el mismo componente (mismo tipo, nombre sin distinguir mayúsculas) en la tarea', async () => {
      await asUser(db, A);
      await insertComponent(db, { ...base(), component_name: 'DupClass' });
      const err = await expectPgError(insertComponent(db, { ...base(), component_name: '  dupclass ' }));
      expect(err.code).toBe('23505');
      expect(err.message).toContain('task_components_task_type_name_uniq');
    });

    it('permite el mismo nombre con otro tipo', async () => {
      await asUser(db, A);
      const row = await insertComponent(db, {
        ...base(), component_type_id: await typeId(db, 'Apex Test Class'), component_name: 'DupClass',
      });
      expect(row.id).toBeTruthy();
    });

    it('rechaza tipos inactivos en nuevos registros pero conserva los existentes', async () => {
      await asUser(db, A);
      const vr = await typeId(db, 'Validation Rule');
      const existing = await insertComponent(db, { ...base(), component_type_id: vr, component_name: 'VR_1' });
      await asUser(db, ADMIN);
      await db.query('update public.component_types set is_active = false where id = $1', [vr]);
      await asUser(db, A);
      const err = await expectPgError(insertComponent(db, { ...base(), component_type_id: vr, component_name: 'VR_2' }));
      expect(err.hint).toBe('field:component_type_id');
      // El existente sigue visible y editable
      const upd = await db.query<Row>(
        `update public.task_components set intervention_type = 'updated' where id = $1 returning *`, [existing.id]);
      expect(upd.rows[0].intervention_type).toBe('updated');
      await asUser(db, ADMIN);
      await db.query('update public.component_types set is_active = true where id = $1', [vr]);
    });

    it('no permite mover un componente a otra tarea', async () => {
      await asUser(db, A);
      const row = await insertComponent(db, { ...base(), component_name: 'NoMove' });
      const { taskId: otherTask } = await createBoardWithTask(db, A, 'Otra');
      await asUser(db, A);
      const err = await expectPgError(
        db.query('update public.task_components set task_id = $1 where id = $2', [otherTask, row.id]));
      expect(err.hint).toBe('field:task_id');
    });
  });

  // ------------------------------------------------------------------ XSS
  describe('XSS', () => {
    it.each([
      '<p>hola</p><script>alert(1)</script>',
      '<p onclick="alert(1)">x</p>',
      '<img src=x onerror=alert(1)>',
      '<a href="javascript:alert(1)">x</a>',
      '<iframe src="https://evil.test"></iframe>',
      '<svg/onload=alert(1)>',
    ])('rechaza contenido peligroso: %s', async (html) => {
      await asUser(db, A);
      const err = await expectPgError(insertComponent(db, {
        task_id: taskA, component_type_id: apex, component_name: 'Xss', intervention_type: 'new', work_detail: html,
      }));
      expect(err.hint).toBe('field:work_detail');
    });

    it('acepta texto que menciona scripts escapado como texto', async () => {
      await asUser(db, A);
      const row = await insertComponent(db, {
        task_id: taskA, component_type_id: apex, component_name: 'XssText', intervention_type: 'new',
        work_detail: '<p>Se quitó el atributo onclick= y el &lt;script&gt; del componente</p>',
      });
      expect(row.work_detail_plain).toBe('Se quitó el atributo onclick= y el <script> del componente');
    });
  });

  // ------------------------------------------------------------------ RLS
  describe('RLS (criterio de aceptación 4)', () => {
    let compA: string;

    beforeAll(async () => {
      await asUser(db, A);
      const row = await insertComponent(db, {
        task_id: taskA, component_type_id: apex, component_name: 'PrivateOfA',
        intervention_type: 'new', work_detail: '<p>secreto</p>',
      });
      compA = row.id as string;
    });

    it('B no puede leer componentes de la tarea de A', async () => {
      await asUser(db, B);
      const r = await db.query('select * from public.task_components where task_id = $1', [taskA]);
      expect(r.rows).toHaveLength(0);
      const all = await db.query<Row>('select task_id from public.task_components');
      expect(all.rows.every((x) => x.task_id !== taskA)).toBe(true);
    });

    it('B no puede crear componentes en la tarea de A', async () => {
      await asUser(db, B);
      const err = await expectPgError(insertComponent(db, {
        task_id: taskA, component_type_id: apex, component_name: 'Intruso', intervention_type: 'new',
        work_detail: '<p>x</p>',
      }));
      expect(err.code).toBe('42501');
    });

    it('B no puede editar ni eliminar componentes de A (0 filas afectadas)', async () => {
      await asUser(db, B);
      const upd = await db.query(`update public.task_components set component_name = 'Hack' where id = $1`, [compA]);
      expect(upd.affectedRows).toBe(0);
      const del = await db.query('delete from public.task_components where id = $1', [compA]);
      expect(del.affectedRows).toBe(0);
      await asSuper(db);
      const r = await db.query<Row>('select component_name from public.task_components where id = $1', [compA]);
      expect(r.rows[0].component_name).toBe('PrivateOfA');
    });

    it('B no ve los componentes de A en la búsqueda entre tareas', async () => {
      await asUser(db, B);
      const r = await db.query('select * from public.search_task_components($1)', ['PrivateOfA']);
      expect(r.rows).toHaveLength(0);
    });

    it('B no ve el historial de la tarea de A', async () => {
      await asUser(db, B);
      const r = await db.query('select * from public.task_history where task_id = $1', [taskA]);
      expect(r.rows).toHaveLength(0);
    });

    it('al agregar a B como miembro del tablero obtiene acceso (misma regla que tareas)', async () => {
      await asUser(db, A);
      await db.query(`insert into public.board_members (board_id, user_id) values ($1, $2)`, [boardA, B]);
      await asUser(db, B);
      const r = await db.query('select * from public.task_components where id = $1', [compA]);
      expect(r.rows).toHaveLength(1);
      await asUser(db, A);
      await db.query('delete from public.board_members where board_id = $1 and user_id = $2', [boardA, B]);
    });

    it('anon no tiene acceso', async () => {
      await db.exec(`reset role; set role anon;`);
      const err = await expectPgError(db.query('select * from public.task_components'));
      expect(err.code).toBe('42501');
    });

    it('can_access_task replica la regla de tasks', async () => {
      await asUser(db, A);
      const r1 = await db.query<{ ok: boolean }>('select public.can_access_task($1) as ok', [taskA]);
      expect(r1.rows[0].ok).toBe(true);
      const r2 = await db.query<{ ok: boolean }>('select public.can_access_task($1) as ok', [taskB]);
      expect(r2.rows[0].ok).toBe(false);
    });
  });

  // ------------------------------------------------------------------ catálogo
  describe('catálogo component_types', () => {
    it('lo lee cualquier autenticado, solo activos en orden para el selector', async () => {
      await asUser(db, B);
      const r = await db.query<Row>(
        'select name from public.component_types where is_active order by sort_order, name');
      expect(r.rows[0].name).toBe('Apex Class');
      expect(r.rows.at(-1)?.name).toBe('Otro');
    });

    it('un no-administrador no puede crear, modificar ni eliminar tipos', async () => {
      await asUser(db, A);
      const ins = await expectPgError(db.query(`insert into public.component_types (name) values ('Hack')`));
      expect(ins.code).toBe('42501');
      const upd = await db.query(`update public.component_types set name = 'Hack' where name = 'Flow'`);
      expect(upd.affectedRows).toBe(0);
      const del = await db.query(`delete from public.component_types where name = 'Report'`);
      expect(del.affectedRows).toBe(0);
    });

    it('el usuario no puede auto-promoverse a administrador', async () => {
      await asUser(db, A);
      const err = await expectPgError(db.query(`update public.profiles set app_role = 'admin' where id = $1`, [A]));
      expect(err.code).toBe('42501');
    });

    it('el administrador crea, renombra, reordena y desactiva', async () => {
      await asUser(db, ADMIN);
      const r = await db.query<Row>(
        `insert into public.component_types (name, metadata_type, sort_order) values ('  Einstein Bot ', 'Bot', 400) returning *`);
      expect(r.rows[0].name).toBe('Einstein Bot');
      await db.query(`update public.component_types set name = 'Einstein Bot v2', sort_order = 5, is_active = false where id = $1`, [r.rows[0].id]);
      const r2 = await db.query<Row>('select * from public.component_types where id = $1', [r.rows[0].id]);
      expect(r2.rows[0]).toMatchObject({ name: 'Einstein Bot v2', sort_order: 5, is_active: false });
    });

    it('rechaza nombres de tipo duplicados sin distinguir mayúsculas', async () => {
      await asUser(db, ADMIN);
      const err = await expectPgError(db.query(`insert into public.component_types (name) values ('apex class')`));
      expect(err.code).toBe('23505');
    });
  });

  // ------------------------------------------------------------------ integridad
  describe('integridad', () => {
    it('no se puede borrar un tipo en uso (ON DELETE RESTRICT)', async () => {
      await asUser(db, ADMIN);
      const err = await expectPgError(db.query('delete from public.component_types where id = $1', [apex]));
      expect(err.code).toBe('23503');
    });

    it('se puede borrar un tipo sin uso', async () => {
      await asUser(db, ADMIN);
      const r = await db.query<Row>(`insert into public.component_types (name) values ('Temporal') returning id`);
      const del = await db.query('delete from public.component_types where id = $1', [r.rows[0].id]);
      expect(del.affectedRows).toBe(1);
    });

    it('borrar una tarea elimina sus componentes (y no falla el historial)', async () => {
      const { taskId } = await createBoardWithTask(db, A, 'Para borrar');
      await asUser(db, A);
      await insertComponent(db, {
        task_id: taskId, component_type_id: apex, component_name: 'Cascade1', intervention_type: 'new', work_detail: '<p>a</p>',
      });
      await insertComponent(db, {
        task_id: taskId, component_type_id: lwc, component_name: 'cascade2', intervention_type: 'updated', work_detail: '<p>b</p>',
      });
      await db.query('delete from public.tasks where id = $1', [taskId]);
      await asSuper(db);
      const r = await db.query<{ n: number }>(
        'select count(*)::int as n from public.task_components where task_id = $1', [taskId]);
      expect(r.rows[0].n).toBe(0);
    });
  });

  // ------------------------------------------------------------------ historial
  describe('historial (criterio de aceptación 2)', () => {
    it('registra creación, edición con diff y eliminación con datos previos', async () => {
      const { taskId } = await createBoardWithTask(db, A, 'Historial');
      await asUser(db, A);
      const row = await insertComponent(db, {
        task_id: taskId, component_type_id: lwc, component_name: 'PortalEmpresa',
        intervention_type: 'new', work_detail: LWC_DETAIL,
      });

      // B (miembro) edita: el historial registra a B como autor
      await asSuper(db);
      const boardId = (await db.query<Row>('select board_id from public.tasks where id = $1', [taskId])).rows[0].board_id;
      await db.query('insert into public.board_members (board_id, user_id) values ($1, $2)', [boardId, B]);
      await asUser(db, B);
      await db.query(`update public.task_components set intervention_type = 'updated' where id = $1`, [row.id]);

      // update sin cambios reales no genera entrada
      await db.query(`update public.task_components set intervention_type = 'updated' where id = $1`, [row.id]);

      await asUser(db, A);
      await db.query('delete from public.task_components where id = $1', [row.id]);

      const h = await db.query<Row>(
        `select action, actor_id, summary, changes, snapshot, created_at
           from public.task_history where task_id = $1 and entity = 'component' order by id`, [taskId]);
      expect(h.rows.map((x) => x.action)).toEqual(['created', 'updated', 'deleted']);

      const [created, updated, deleted] = h.rows;
      expect(created.actor_id).toBe(A);
      expect(created.summary).toBe('Componente agregado: Lightning Web Component · PortalEmpresa');

      expect(updated.actor_id).toBe(B);
      expect(updated.created_at).toBeTruthy();
      expect(updated.changes).toEqual({ intervention_type: { old: 'new', new: 'updated' } });

      expect(deleted.actor_id).toBe(A);
      expect(deleted.snapshot).toMatchObject({
        component_type_name: 'Lightning Web Component',
        component_name: 'PortalEmpresa',
        intervention_type: 'updated',
        work_detail: LWC_DETAIL,
      });
    });

    it('el diff incluye tipo (por nombre), nombre, nota y detalle en texto plano', async () => {
      const { taskId } = await createBoardWithTask(db, A, 'Diff');
      await asUser(db, A);
      const row = await insertComponent(db, {
        task_id: taskId, component_type_id: apex, component_name: 'Svc', intervention_type: 'new', work_detail: '<p>uno</p>',
      });
      await db.query(
        `update public.task_components
            set component_type_id = $2, component_name = 'Svc2', other_type_note = 'Bot', work_detail = '<p>dos</p>'
          where id = $1`, [row.id, otro]);
      const h = await db.query<Row>(
        `select changes from public.task_history where entity_id = $1 and action = 'updated'`, [row.id]);
      expect(h.rows[0].changes).toEqual({
        component_type: { old: 'Apex Class', new: 'Otro' },
        component_name: { old: 'Svc', new: 'Svc2' },
        other_type_note: { old: null, new: 'Bot' },
        work_detail: { old: 'uno', new: 'dos' },
      });
    });

    it('los clientes no pueden escribir ni borrar el historial', async () => {
      await asUser(db, A);
      const ins = await expectPgError(db.query(
        `insert into public.task_history (task_id, action) values ($1, 'fake')`, [taskA]));
      expect(ins.code).toBe('42501');
      const del = await expectPgError(db.query('delete from public.task_history where task_id = $1', [taskA]));
      expect(del.code).toBe('42501');
    });
  });

  // ------------------------------------------------------------------ búsqueda
  describe('búsqueda entre tareas (criterio de aceptación 3)', () => {
    it('encuentra PortalEmpresa en ambas tareas sin distinguir mayúsculas', async () => {
      const { taskId: t2 } = await createBoardWithTask(db, A, 'Segunda tarea portal');
      await asUser(db, A);
      await insertComponent(db, {
        task_id: t2, component_type_id: lwc, component_name: 'PortalEmpresa', intervention_type: 'updated',
        work_detail: '<p>Ajustes</p>',
      });
      const r = await db.query<Row>('select * from public.search_task_components($1)', ['portalempresa']);
      const titles = r.rows.map((x) => x.task_title);
      expect(titles).toEqual(expect.arrayContaining(['Portal empresas', 'Segunda tarea portal']));
      expect(r.rows.find((x) => x.task_title === 'Segunda tarea portal')).toMatchObject({
        intervention_type: 'updated', component_type_name: 'Lightning Web Component',
      });
    });

    it('trata % y _ como literales', async () => {
      await asUser(db, A);
      const r = await db.query('select * from public.search_task_components($1)', ['%']);
      expect(r.rows).toHaveLength(0);
      const empty = await db.query('select * from public.search_task_components($1)', ['  ']);
      expect(empty.rows).toHaveLength(0);
    });
  });
});

describe('migración reversible', () => {
  it('el rollback elimina los objetos y la migración puede volver a aplicarse', async () => {
    const db = await createDb();
    await db.exec(ROLLBACK_SQL);
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('task_components','component_types')`);
    expect(r.rows[0].n).toBe(0);
    // re-aplicar
    const { readFileSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');
    const dir = resolve(__dirname, '../../supabase/migrations');
    await db.exec(readFileSync(join(dir, '20261110000000_task_components.sql'), 'utf8'));
    await db.exec(readFileSync(join(dir, '20261110000100_seed_component_types.sql'), 'utf8'));
    // seed idempotente
    await db.exec(readFileSync(join(dir, '20261110000100_seed_component_types.sql'), 'utf8'));
    const c = await db.query<{ n: number }>('select count(*)::int as n from public.component_types');
    expect(c.rows[0].n).toBe(34);
  });
});
