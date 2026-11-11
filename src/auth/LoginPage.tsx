import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error: err } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) setError(err.message);
    else if (mode === 'signup') setInfo('Cuenta creada. Revisa tu correo si se requiere confirmación.');
  };

  return (
    <main className="page page--narrow">
      <h1>Kanban · Salesforce</h1>
      <form className="form card" onSubmit={submit}>
        <h2 className="h3">{mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        {info && <div className="alert">{info}</div>}
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            className="input"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Procesando…' : mode === 'signin' ? 'Entrar' : 'Registrarme'}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
        </button>
      </form>
    </main>
  );
}
