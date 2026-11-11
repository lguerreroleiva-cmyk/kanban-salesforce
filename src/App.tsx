import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './auth/LoginPage';
import { BoardPage } from './features/boards/BoardPage';
import { BoardsPage } from './features/boards/BoardsPage';
import { ComponentSearchPage } from './features/components/ComponentSearchPage';
import { ComponentTypesAdminPage } from './features/components/ComponentTypesAdminPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <p className="page muted">Cargando…</p>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  return (
    <>
      <nav className="topbar" aria-label="Principal">
        <NavLink to="/" className="topbar__brand">
          Kanban · SF
        </NavLink>
        <div className="topbar__links">
          <NavLink to="/">Tableros</NavLink>
          <NavLink to="/components/search">Buscar componente</NavLink>
          {isAdmin && <NavLink to="/admin/component-types">Catálogo</NavLink>}
        </div>
        <div className="topbar__user">
          <span className="muted small">{user?.email}</span>
          <button type="button" className="btn btn--sm" onClick={() => void signOut()}>
            Salir
          </button>
        </div>
      </nav>
      {children}
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <Shell>
                  <Routes>
                    <Route path="/" element={<BoardsPage />} />
                    <Route path="/boards/:boardId" element={<BoardPage />} />
                    <Route path="/components/search" element={<ComponentSearchPage />} />
                    <Route path="/admin/component-types" element={<ComponentTypesAdminPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
