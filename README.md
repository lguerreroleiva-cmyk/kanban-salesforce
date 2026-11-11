# Kanban · Salesforce

App Kanban (React + Vite + TypeScript + Supabase PostgreSQL) con registro estructurado de
**componentes Salesforce desarrollados, actualizados o configurados** por tarea.

Ver [RESUMEN_ENTREGA.md](RESUMEN_ENTREGA.md) para el análisis (Paso 0), plan, decisiones y supuestos.

## Requisitos

- Node.js 20+ (probado con Node 26)
- Supabase CLI + Docker (para el stack local y `gen types`)

## Puesta en marcha local

```bash
npm install
supabase start                 # levanta Postgres/Auth/PostgREST locales
supabase db reset              # aplica supabase/migrations/* y seed.sql
cp .env.example .env.local     # completar VITE_SUPABASE_ANON_KEY con la salida de `supabase status`
npm run gen:types              # regenera src/lib/database.types.ts desde la BD
npm run dev                    # http://localhost:5173
```

Para habilitar la pantalla **Catálogo** a un usuario:

```sql
update public.profiles set app_role = 'admin' where email = 'correo@dominio';
```

## Despliegue a producción

```bash
supabase link --project-ref <ref>
supabase db push               # aplica 20261110000000_task_components.sql y 20261110000100_seed_component_types.sql
npm run build                  # genera dist/
```

Reversión: `psql "$DATABASE_URL" -f supabase/rollback/20261110000000_task_components_down.sql`
(elimina los componentes registrados; respaldar antes).

## Pruebas

| Comando | Qué cubre |
|---|---|
| `npm run test:db` | Migraciones reales sobre PostgreSQL embebido (PGlite): CRUD, validaciones, RLS, integridad, historial, XSS, búsqueda, rollback. No requiere Docker. |
| `npm run test:unit` | Validaciones, sanitización XSS, mapeo de errores, exportaciones (CSV/Excel/PDF), UI de la sección (Testing Library). |
| `npm test` | Ambas. |
| `npm run test:e2e` | Playwright escritorio + móvil contra el stack local (`E2E_EMAIL`, `E2E_PASSWORD`). |

## Estructura relevante

```
supabase/migrations/      esquema base + task_components + seed del catálogo
supabase/rollback/        script de reversión
src/features/components/  sección, formulario, selector, búsqueda, admin del catálogo, API
src/features/export/      aplanado + CSV / Excel / PDF
src/features/tasks/       panel de detalle e historial
tests/db/                 pruebas de BD (PGlite + shim de auth de Supabase)
tests/unit/               pruebas unitarias y de UI
tests/e2e/                Playwright
```
