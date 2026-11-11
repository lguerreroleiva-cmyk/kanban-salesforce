import type { Tables, TablesUpdate } from '../../lib/database.types';
import { supabase } from '../../lib/supabase';

export type Board = Tables<'boards'>;
export type BoardColumn = Tables<'board_columns'>;
export type Task = Tables<'tasks'>;
export type Profile = Tables<'profiles'>;
export type HistoryEntry = Tables<'task_history'>;

export async function listBoards(): Promise<Board[]> {
  const { data, error } = await supabase.from('boards').select('*').order('created_at');
  if (error) throw error;
  return data;
}

export async function createBoard(name: string, ownerId: string): Promise<Board> {
  const { data, error } = await supabase.from('boards').insert({ name: name.trim(), owner_id: ownerId }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getBoard(boardId: string): Promise<{ board: Board; columns: BoardColumn[]; tasks: Task[] }> {
  const [b, c, t] = await Promise.all([
    supabase.from('boards').select('*').eq('id', boardId).single(),
    supabase.from('board_columns').select('*').eq('board_id', boardId).order('position'),
    supabase.from('tasks').select('*').eq('board_id', boardId).order('position').order('created_at'),
  ]);
  if (b.error) throw b.error;
  if (c.error) throw c.error;
  if (t.error) throw t.error;
  return { board: b.data, columns: c.data, tasks: t.data };
}

export async function createTask(boardId: string, columnId: string, title: string, createdBy: string): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ board_id: boardId, column_id: columnId, title: title.trim(), created_by: createdBy })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getTask(taskId: string): Promise<Task> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId: string, patch: TablesUpdate<'tasks'>): Promise<Task> {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', taskId).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function listHistory(taskId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function listProfiles(): Promise<Map<string, Profile>> {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return new Map(data.map((p) => [p.id, p]));
}

export function profileName(profiles: Map<string, Profile>, id: string | null | undefined): string {
  if (!id) return 'Sistema';
  const p = profiles.get(id);
  return p?.full_name || p?.email || 'Usuario';
}
