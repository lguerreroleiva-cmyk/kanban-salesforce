/**
 * MODO DEMO (`npm run demo`): cliente Supabase falso, en memoria, para recorrer la UI sin backend.
 * Emula lo mínimo que usa la app (select/insert/update/delete con eq/in/order, joins de tipo,
 * RPC y triggers principales). NO se incluye en el build de producción.
 */
import { htmlToPlainText } from '../lib/html';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const USER = { id: 'demo-user', email: 'demo@kanban.test' };

const SEED_TYPES: [string, string | null, boolean][] = [
  ['Apex Class', 'ApexClass', false], ['Apex Trigger', 'ApexTrigger', false], ['Apex Test Class', 'ApexClass', false],
  ['Lightning Web Component', 'LightningComponentBundle', false], ['Aura Component', 'AuraDefinitionBundle', false],
  ['Flow', 'Flow', false], ['Validation Rule', 'ValidationRule', false], ['Custom Object', 'CustomObject', false],
  ['Custom Field', 'CustomField', false], ['Record Type', 'RecordType', false], ['Page Layout', 'Layout', false],
  ['Lightning Page', 'FlexiPage', false], ['Permission Set', 'PermissionSet', false], ['Profile', 'Profile', false],
  ['Named Credential', 'NamedCredential', false], ['Report', 'Report', false], ['Dashboard', 'Dashboard', false],
  ['ApexClass', 'ApexClass', false], ['Otro', null, true],
];

const db: Record<string, Row[]> = {
  profiles: [{ id: USER.id, email: USER.email, full_name: 'Usuario Demo', app_role: 'admin', created_at: now(), updated_at: now() }],
  boards: [], board_members: [], board_columns: [], tasks: [], task_history: [], component_types: [], task_components: [],
};
let historySeq = 1;

SEED_TYPES.forEach(([name, meta, note], i) =>
  db.component_types.push({
    id: uid(), name, metadata_type: meta, requires_note: note, sort_order: (i + 1) * 10,
    is_active: name !== 'Dashboard', created_at: now(), updated_at: now(),
  }));

function typeByName(n: string) {
  return db.component_types.find((t) => t.name === n)!;
}

function history(task_id: string, entity: string, action: string, summary: string, changes: Row = {}, entity_id?: string) {
  db.task_history.push({
    id: historySeq++, task_id, actor_id: USER.id, entity, entity_id: entity_id ?? task_id, action, summary,
    changes, snapshot: null, created_at: now(),
  });
}

// ------------------------------------------------------------------ "triggers"
function onInsert(table: string, r: Row): Row {
  const base = { id: r.id ?? uid(), created_at: now(), updated_at: now() };
  if (table === 'boards') {
    const b: Row = { ...base, owner_id: USER.id, ...r };
    db.board_members.push({ board_id: b.id, user_id: USER.id, role: 'owner', created_at: now() });
    ['Por hacer', 'En progreso', 'En revisión', 'Hecho'].forEach((name, position) =>
      db.board_columns.push({ id: uid(), board_id: b.id, name, position, created_at: now() }));
    return b;
  }
  if (table === 'tasks') {
    const t: Row = { ...base, description: '', position: 0, assignee_id: null, due_date: null, created_by: USER.id, ...r };
    history(t.id, 'task', 'created', `Tarea creada: ${t.title}`);
    return t;
  }
  if (table === 'task_components') {
    const name = String(r.component_name ?? '').trim();
    const dup = db.task_components.some(
      (c) => c.task_id === r.task_id && c.component_type_id === r.component_type_id && c.component_name.toLowerCase() === name.toLowerCase());
    if (dup) throw { code: '23505', message: 'duplicate key value violates unique constraint "task_components_task_type_name_uniq"' };
    const c: Row = { ...base, sort_order: 0, other_type_note: null, ...r, component_name: name, work_detail_plain: htmlToPlainText(r.work_detail), created_by: USER.id, updated_by: USER.id };
    const type = db.component_types.find((t) => t.id === c.component_type_id);
    history(c.task_id, 'component', 'created', `Componente agregado: ${type?.name} · ${c.component_name}`, {}, c.id);
    return c;
  }
  if (table === 'component_types') {
    if (db.component_types.some((t) => t.name.toLowerCase() === String(r.name).trim().toLowerCase())) {
      throw { code: '23505', message: 'duplicate key value violates unique constraint "component_types_name_lower_uniq"' };
    }
    return { ...base, metadata_type: null, requires_note: false, sort_order: 0, is_active: true, ...r, name: String(r.name).trim() };
  }
  return { ...base, ...r };
}

function onUpdate(table: string, before: Row, patch: Row): Row {
  const after: Row = { ...before, ...patch, updated_at: now() };
  if (table === 'task_components') {
    after.work_detail_plain = htmlToPlainText(after.work_detail);
    const changes: Row = {};
    const typeName = (id: string) => db.component_types.find((t) => t.id === id)?.name;
    if (before.component_type_id !== after.component_type_id) changes.component_type = { old: typeName(before.component_type_id), new: typeName(after.component_type_id) };
    for (const k of ['component_name', 'other_type_note', 'intervention_type']) {
      if ((before[k] ?? null) !== (after[k] ?? null)) changes[k] = { old: before[k] ?? null, new: after[k] ?? null };
    }
    if (before.work_detail !== after.work_detail) changes.work_detail = { old: before.work_detail_plain, new: after.work_detail_plain };
    if (Object.keys(changes).length) history(after.task_id, 'component', 'updated', `Componente actualizado: ${typeName(after.component_type_id)} · ${after.component_name}`, changes, after.id);
  }
  if (table === 'tasks') {
    const changes: Row = {};
    if (before.title !== after.title) changes.title = { old: before.title, new: after.title };
    if (before.description !== after.description) changes.description = { changed: true };
    if (before.column_id !== after.column_id) {
      const col = (id: string) => db.board_columns.find((c) => c.id === id)?.name;
      changes.column_id = { old: col(before.column_id), new: col(after.column_id) };
    }
    if (Object.keys(changes).length) history(after.id, 'task', changes.column_id && Object.keys(changes).length === 1 ? 'moved' : 'updated', `Tarea actualizada: ${after.title}`, changes);
  }
  return after;
}

function onDelete(table: string, r: Row) {
  if (table === 'component_types' && db.task_components.some((c) => c.component_type_id === r.id)) {
    throw { code: '23503', message: 'violates foreign key constraint' };
  }
  if (table === 'task_components') {
    const type = db.component_types.find((t) => t.id === r.component_type_id);
    history(r.task_id, 'component', 'deleted', `Componente eliminado: ${type?.name} · ${r.component_name}`, {}, r.id);
  }
  if (table === 'tasks') {
    db.task_components = db.task_components.filter((c) => c.task_id !== r.id);
    db.task_history = db.task_history.filter((h) => h.task_id !== r.id);
  }
}

function withJoins(table: string, cols: string, r: Row): Row {
  if (table === 'task_components' && cols.includes('component_type:')) {
    const t = db.component_types.find((x) => x.id === r.component_type_id)!;
    return { ...r, component_type: { id: t.id, name: t.name, requires_note: t.requires_note, is_active: t.is_active, metadata_type: t.metadata_type } };
  }
  return r;
}

// ------------------------------------------------------------------ query builder
class Query implements PromiseLike<{ data: any; error: any; count?: number }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private cols = '*';
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private one: 'single' | 'maybe' | null = null;
  private max: number | null = null;

  constructor(private table: string) {}
  select(cols = '*') { this.cols = cols; return this; }
  insert(p: Row | Row[]) { this.mode = 'insert'; this.payload = p; return this; }
  update(p: Row) { this.mode = 'update'; this.payload = p; return this; }
  delete(_opts?: { count?: string }) { this.mode = 'delete'; return this; }
  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this; }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orders.push({ col, asc: o?.ascending ?? true }); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }

  private run() {
    const rows = db[this.table];
    let out: Row[] = [];
    let count: number | undefined;
    if (this.mode === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      out = items.map((p) => onInsert(this.table, p));
      rows.push(...out);
    } else {
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.mode === 'update') {
        out = matched.map((r) => {
          const updated = onUpdate(this.table, r, this.payload as Row);
          rows[rows.indexOf(r)] = updated;
          return updated;
        });
      } else if (this.mode === 'delete') {
        matched.forEach((r) => onDelete(this.table, r));
        db[this.table] = rows.filter((r) => !matched.includes(r));
        count = matched.length;
        out = matched;
      } else {
        out = [...matched];
      }
    }
    for (const o of [...this.orders].reverse()) {
      out.sort((a, b) => (a[o.col] > b[o.col] ? 1 : a[o.col] < b[o.col] ? -1 : 0) * (o.asc ? 1 : -1));
    }
    if (this.max !== null) out = out.slice(0, this.max);
    out = out.map((r) => withJoins(this.table, this.cols, r));
    if (this.one) {
      if (out.length === 0 && this.one === 'single') return { data: null, error: { code: 'PGRST116', message: 'Registro no encontrado' } };
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, error: null, count };
  }

  then<A, B>(ok?: ((v: { data: any; error: any; count?: number }) => A | PromiseLike<A>) | null, ko?: ((e: unknown) => B | PromiseLike<B>) | null) { // eslint-disable-line @typescript-eslint/no-explicit-any
    let result;
    try {
      result = this.run();
    } catch (e) {
      result = { data: null, error: e };
    }
    return new Promise((r) => setTimeout(r, 120)).then(() => result).then(ok, ko);
  }
}

function rpc(name: string, args: Row) {
  try {
    if (name === 'search_task_components') {
      const q = String(args.p_query).trim().toLowerCase();
      const data = db.task_components
        .filter((c) => c.component_name.toLowerCase().includes(q))
        .map((c) => {
          const t = db.tasks.find((x) => x.id === c.task_id)!;
          const b = db.boards.find((x) => x.id === t.board_id)!;
          const ty = db.component_types.find((x) => x.id === c.component_type_id)!;
          return {
            component_id: c.id, task_id: t.id, task_title: t.title, board_id: b.id, board_name: b.name, component_type_id: ty.id,
            component_type_name: ty.name, component_name: c.component_name, intervention_type: c.intervention_type,
            work_detail_plain: c.work_detail_plain, created_at: c.created_at, updated_at: c.updated_at,
          };
        });
      return Promise.resolve({ data, error: null });
    }
    if (name === 'component_type_usage') {
      const data = db.component_types.map((t) => ({
        component_type_id: t.id, usage_count: db.task_components.filter((c) => c.component_type_id === t.id).length,
      }));
      return Promise.resolve({ data, error: null });
    }
    if (name === 'merge_component_types') {
      const { p_source, p_target } = args;
      const moved = db.task_components.filter((c) => c.component_type_id === p_source);
      const conflicts = moved.filter((s) => db.task_components.some(
        (t) => t.task_id === s.task_id && t.component_type_id === p_target && t.component_name.toLowerCase() === s.component_name.toLowerCase()));
      if (conflicts.length) {
        return Promise.resolve({ data: null, error: { code: '23505', hint: 'field:target', message: `No se puede fusionar: ${conflicts.length} tarea(s) ya tienen el mismo componente` } });
      }
      moved.forEach((c) => {
        db.task_components[db.task_components.indexOf(c)] = onUpdate('task_components', c, { component_type_id: p_target });
      });
      db.component_types = db.component_types.filter((t) => t.id !== p_source);
      return Promise.resolve({ data: moved.length, error: null });
    }
  } catch (e) {
    return Promise.resolve({ data: null, error: e });
  }
  return Promise.resolve({ data: null, error: { message: `RPC ${name} no disponible en demo` } });
}

// ------------------------------------------------------------------ datos de ejemplo
(function seed() {
  const board = onInsert('boards', { name: 'Portal Empresas' });
  db.boards.push(board);
  db.boards.push(onInsert('boards', { name: 'Integraciones ERP' }));
  const cols = db.board_columns.filter((c) => c.board_id === board.id);
  const mk = (title: string, col: number, desc = '', due: string | null = null) => {
    const t = onInsert('tasks', { board_id: board.id, column_id: cols[col].id, title, description: desc, due_date: due });
    db.tasks.push(t);
    return t;
  };
  const t1 = mk('Formulario de solicitudes del portal', 1, '<p>Captura de solicitudes de empresas con validaciones.</p>', '2026-11-28');
  mk('Configurar Named Credential para ERP', 0);
  const t3 = mk('Ajustar permisos de usuarios externos', 2);
  mk('Reporte de solicitudes por estado', 3);
  const comp = (task: Row, type: string, name: string, intervention: string, detail: string) => {
    const c = onInsert('task_components', {
      task_id: task.id, component_type_id: typeByName(type).id, component_name: name, intervention_type: intervention, work_detail: detail,
    });
    db.task_components.push(c);
  };
  comp(t1, 'Lightning Web Component', 'PortalEmpresa', 'new',
    '<p>Desarrollo del componente para capturar solicitudes, validar los campos del formulario y comunicarse con los métodos Apex correspondientes.</p>');
  comp(t1, 'Apex Class', 'SolicitudController', 'new', '<p>Métodos <code>@AuraEnabled</code> para crear y consultar solicitudes.</p><ul><li>crearSolicitud</li><li>listarSolicitudes</li></ul>');
  comp(t1, 'Custom Field', 'Solicitud__c.Estado__c', 'updated', '<p>Se agregaron los valores <strong>En revisión</strong> y <strong>Rechazada</strong>.</p>');
  comp(t3, 'Permission Set', 'Portal_Empresa_Externo', 'configured', '<p>Acceso de lectura/creación a Solicitud__c y a la clase SolicitudController.</p>');
  comp(t3, 'Lightning Web Component', 'PortalEmpresa', 'updated', '<p>Se ocultan acciones según permisos del usuario externo.</p>');
})();

// ------------------------------------------------------------------ cliente
const session = { user: USER, access_token: 'demo', expires_at: 9999999999 };
export const supabase = {
  from: (table: string) => new Query(table),
  rpc,
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: { session }, error: null }),
    signUp: async () => ({ data: { session }, error: null }),
    signOut: async () => ({ error: null }),
  },
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any
