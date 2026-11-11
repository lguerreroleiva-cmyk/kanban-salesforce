import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
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

export function Brand() {
  return (
    <NavLink to="/" className="brand">
      <span className="brand__logo" aria-hidden="true">
        ☁️
      </span>
      <span className="brand__name">
        Kanban SF
        <span className="brand__sub">Componentes Salesforce</span>
      </span>
    </NavLink>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setNavOpen(false), [location.pathname]);

  const email = user?.email ?? '';
  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Navegación principal">
        <Brand />
        <nav className="nav">
          <NavLink to="/" end>
            <span className="nav__icon" aria-hidden="true">📋</span> Tableros
          </NavLink>
          <NavLink to="/components/search">
            <span className="nav__icon" aria-hidden="true">🔎</span> Buscar componente
          </NavLink>
          {isAdmin && (
            <>
              <span className="nav__section">Configuración</span>
              <NavLink to="/admin/component-types">
                <span className="nav__icon" aria-hidden="true">🧩</span> Tipos de componente
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar__footer">
          <div className="user">
            <span className="avatar" aria-hidden="true">
              {email.slice(0, 1).toUpperCase() || '?'}
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="user__email" title={email}>
                {email}
              </span>
              <span className="user__role">{isAdmin ? 'Administrador' : 'Miembro'}</span>
            </span>
          </div>
          <button type="button" className="btn btn--sm btn--sidebar" onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      <div className="main">
        <header className="mobilebar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Abrir menú"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <Brand />
        </header>
        {children}
      </div>
    </div>
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
