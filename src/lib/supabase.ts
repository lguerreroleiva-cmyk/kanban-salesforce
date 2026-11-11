import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-anon-key';

if (!import.meta.env.VITE_SUPABASE_URL && import.meta.env.MODE !== 'test') {
  console.warn('VITE_SUPABASE_URL no está definido; usando la instancia local por defecto.');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
