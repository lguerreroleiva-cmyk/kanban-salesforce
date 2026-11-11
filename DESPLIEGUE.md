# Despliegue: Supabase + Netlify (desde cero)

## 1. Supabase — crear el proyecto
1. Entrar a https://supabase.com → **Start your project** → iniciar sesión (GitHub o correo).
2. **New project**: elegir organización, nombre (`kanban-salesforce`), contraseña de BD (guardarla) y región
   cercana (p. ej. *South America (São Paulo)*). Esperar ~2 min.

## 2. Supabase — crear la base de datos
En **SQL Editor → New query**, pegar y ejecutar (**Run**) cada archivo, **en este orden**, uno por consulta:
1. `supabase/migrations/20261101000000_base_kanban_schema.sql`
2. `supabase/migrations/20261110000000_task_components.sql`
3. `supabase/migrations/20261110000100_seed_component_types.sql`
4. `supabase/migrations/20261111000000_component_types_maintenance.sql` (mantenedor: uso por tipo y fusión)

Cada uno debe terminar en *Success. No rows returned*.
Si ya tenías aplicados los tres primeros (versión 1.1), solo ejecuta el 4. Verificar en **Table Editor** que existen `tasks`,
`task_components` y `component_types` (34 filas).

## 3. Supabase — copiar las credenciales
**Project Settings → API** (o el botón **Connect**):
- **Project URL** → `https://xxxx.supabase.co`
- **anon public key** (pestaña *Legacy API keys*) o la **publishable key** (`sb_publishable_...`).

Nunca usar la `service_role` / `secret` key en el frontend.

## 4. Netlify — publicar el sitio
Opción A (recomendada, despliegue automático): subir la carpeta del proyecto a un repositorio de GitHub, luego en
https://app.netlify.com → **Add new project → Import an existing project → GitHub** → elegir el repo.
Netlify lee `netlify.toml` (build `npm run build`, publica `dist`).

Opción B (sin GitHub): en local, crear `.env.local` con las variables del paso 5, ejecutar `npm install` y
`npm run build`, y arrastrar la carpeta `dist` a **Add new project → Deploy manually**.
(`public/_redirects` se copia a `dist` y resuelve las rutas internas.)

## 5. Netlify — variables de entorno (opción A)
**Project configuration → Environment variables → Add a variable**:

| Clave | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL del paso 3 |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key del paso 3 |

Luego **Deploys → Trigger deploy → Clear cache and deploy site** (Vite las incrusta al compilar).

## 6. Supabase — autorizar la URL de Netlify
**Authentication → URL Configuration**:
- **Site URL**: `https://<tu-sitio>.netlify.app`
- **Redirect URLs**: agregar `https://<tu-sitio>.netlify.app/**`

## 7. Crear usuarios y el administrador
- Registrarse desde la app (pantalla de login → *Regístrate*) y confirmar el correo, **o** crear usuarios en
  **Authentication → Users → Add user → Create new user** marcando *Auto Confirm User*.
- Nombrar administrador (habilita la pantalla *Catálogo*), en el SQL Editor:
  ```sql
  update public.profiles set app_role = 'admin' where email = 'tu-correo@dominio';
  ```
  Cerrar sesión y volver a entrar.

## 8. Prueba rápida
Crear tablero → crear tarea → abrir tarea → **Agregar componente** → guardar → ver historial →
**Buscar componente** → **Exportar Excel**.

## Problemas comunes
| Síntoma | Causa |
|---|---|
| Pantalla en blanco / error de conexión | Variables mal escritas o no se redeployó tras agregarlas. |
| 404 al recargar una URL interna | Falta la regla SPA (`netlify.toml` / `_redirects`). |
| El enlace del correo apunta a `localhost` | Site URL de Supabase sin actualizar (paso 6). |
| No llegan correos de confirmación | El correo integrado de Supabase permite pocos envíos por hora: crear usuarios desde el panel o configurar SMTP propio. |
| Error de permisos al crear/editar | El usuario no es miembro del tablero, o no es admin (catálogo). |
| Rollback falla en `supabase_migrations` | Si las migraciones se aplicaron por SQL Editor, omitir esa última sentencia del script. |
