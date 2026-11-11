import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Tables } from '../lib/database.types';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Tables<'profiles'> | null;
  /** Rol de administración de la app: profiles.app_role = 'admin'. */
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [session?.user.id]);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.app_role === 'admin',
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
