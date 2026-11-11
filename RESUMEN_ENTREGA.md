# Resumen de entrega — Registro de componentes Salesforce por tarea

## Versión 1.2 — Mejoras (2026-11-11)

| # | Pedido | Qué se hizo |
|---|---|---|
| 1 | Interfaz más amigable y colores vivos | Barra lateral con íconos (menú deslizable en móvil), migas de pan, tableros con color propio, columnas con color por estado, tarjetas con contador 🧩 de componentes y fecha límite, intervenciones con color + ícono + texto (Nuevo verde, Actualizado azul, Configurado naranja), historial como línea de tiempo, login renovado. Modo claro y oscuro. |
| 2 | Mantenedor de componentes (había nombres «duplicados») | La BD no tenía nombres duplicados (índice único); el selector mostraba «Nombre · MetadataType» (p. ej. «Flow · Flow», «Report · Report»), que parecía duplicado. Ahora el selector muestra solo el nombre. Nueva pantalla **Configuración → Tipos de componente**: crear, editar, activar/desactivar (interruptor), reordenar, eliminar (solo si no está en uso), **ver cuántos componentes usa cada tipo**, **aviso automático de posibles duplicados** y **fusionar** un tipo en otro (mueve los componentes de todas las tareas, deja historial y elimina el duplicado). |
| 3 | Un solo campo para el tipo, con búsqueda tipo LIKE | El campo «Tipo de componente» es ahora un combobox único: al escribir parte del nombre filtra como `ILIKE '%texto%'` (sin mayúsculas ni tildes), resalta la coincidencia, prioriza las que empiezan con el texto y se maneja con ↑/↓/Enter/Esc. El filtrado se hace en el navegador porque el catálogo completo (~35 tipos) ya está cargado; equivale al LIKE y evita una consulta por tecla. |

**Migración nueva:** `20261111000000_component_types_maintenance.sql` (funciones `component_type_usage()` y
`merge_component_types()`, solo administradores). Reversión: `supabase/rollback/20261111000000_component_types_maintenance_down.sql`.

**Pruebas:** 131/131 (BD 53, unitarias/UI 78). Nuevas: fusión y uso por tipo en BD (permisos, conflictos, historial),
combobox (LIKE, teclado, restauración al salir), mantenedor (duplicados, crear, editar, activar, fusionar, eliminar).
Revisión visual en el modo demo: escritorio y móvil, claro y oscuro.

---

## ⚠️ Aviso principal

La carpeta de destino estaba vacía y no se encontró en el equipo la app Kanban existente.
Por decisión del usuario se construyó **una app Kanban de referencia completa** y el requisito se
implementó sobre ella. El Paso 0 documenta el esquema base **definido** (no inspeccionado).
Si existe otra base de código, cada punto marcado como **[SUPUESTO]** debe contrastarse con ella antes
de integrar.

---

## Paso 0 — Análisis (esquema base)

| Tema | Implementación base | Archivo |
|---|---|---|
| Tabla de tareas y PK | `public.tasks`, PK `id uuid` | `supabase/migrations/20261101000000_base_kanban_schema.sql` |
| Regla de acceso a tareas | Ser miembro del tablero: `public.is_board_member(board_id)` (tabla `board_members`; el creador queda como `owner` por trigger) **[SUPUESTO]** | ídem |
| Historial de tareas | Tabla `public.task_history` (`entity`, `action`, `changes jsonb {campo:{old,new}}`, `snapshot`), escrita **solo** por triggers `SECURITY DEFINER`; los clientes solo pueden leer | ídem |
| RLS sobre tareas | `tasks_select/insert/update/delete` → `is_board_member(board_id)` | ídem |
| Rol de administración | `profiles.app_role = 'admin'` → `public.is_app_admin()`; un usuario no puede auto-promoverse (trigger) **[SUPUESTO]** | ídem |
| Editor enriquecido | Tiptap (StarterKit), guarda **HTML** (`tasks.description text`) | `src/components/RichTextEditor.tsx` |
| Exportación | CSV, Excel (ExcelJS) y PDF (jsPDF + autotable) desde el tablero | `src/features/export/*` |

## Plan ejecutado

1. **Migraciones**: `20261110000000_task_components.sql` (tablas, constraints, índices, triggers, funciones, RLS) y
   `20261110000100_seed_component_types.sql` (seed idempotente). Reversión en `supabase/rollback/`.
2. **UI**: sección propia en el panel de tarea, formulario modal, selector con búsqueda, búsqueda entre tareas,
   administración del catálogo.
3. **Exportaciones**: columna resumen + hoja/archivo de componentes + subsección en PDF.
4. **Pruebas**: BD (PostgreSQL real vía PGlite), unitarias/UI (Vitest + Testing Library), E2E (Playwright).

## Decisiones tomadas

| Decisión | Motivo |
|---|---|
| `work_detail` como **HTML text** (no jsonb) | Mismo formato que `tasks.description` (patrón existente). |
| `work_detail_plain` **derivado en BD** por trigger (`html_to_plain`) | El cliente no puede falsearlo; se ignora lo que envíe. Tiene `default ''` para que el tipo Insert no lo exija; el CHECK impide vacío. |
| `created_by`/`updated_by`/`created_at` forzados por trigger + verificados por RLS `WITH CHECK` | Requisito: no confiar en el cliente. |
| `can_access_task()` delega en `is_board_member()` | Replica **exactamente** la regla de `tasks` por construcción; un cambio futuro de la regla aplica a ambas. |
| Validaciones de negocio en trigger con `HINT = 'field:<columna>'` | El cliente asocia cada error de BD a su campo (incluye «Otro» sin especificar, detalle vacío, tipo inactivo). |
| Nombre: el trigger aplica `btrim` + CHECK `component_name = btrim(component_name)` | Espacios al inicio/fin se recortan; nunca se persisten. |
| Tipos inactivos: rechazados al **crear** o al **cambiar** de tipo; los existentes siguen editables | «No aparecen en el selector de nuevos registros, pero se siguen mostrando». |
| Un componente no puede moverse a otra tarea (`task_id` inmutable) | Evita romper la trazabilidad del historial. |
| Historial vía trigger `AFTER INSERT/UPDATE/DELETE` en `task_history` (`entity = 'component'`) | Reutiliza la tabla existente; ningún cliente puede omitirlo. Diff por campo; el tipo se registra por **nombre**; el detalle se compara en texto plano. Updates sin cambios no generan entrada. |
| Al borrar la **tarea**, los componentes se borran en cascada **sin** entrada de historial | El historial de la tarea también se elimina en cascada (comportamiento base); el trigger detecta el caso y no falla. |
| XSS: DOMPurify al guardar **y** al renderizar + rechazo en BD de `<script>`, `on*=`, `javascript:` etc. | Defensa en profundidad. Lista blanca de etiquetas = las que produce el editor, sin atributos. |
| Búsqueda entre tareas: RPC `search_task_components` `SECURITY INVOKER` | RLS se aplica automáticamente; coincidencia parcial case-insensitive con `%`/`_` escapados; exactas primero. |
| CSV: dos archivos (`_tareas.csv` con resumen, `_componentes.csv`), BOM UTF-8 y neutralización de fórmulas (`=`, `+`, `-`, `@`) | Compatibilidad con Excel y prevención de CSV injection. |
| Excel/PDF cargados con `import()` dinámico | Evita penalizar la carga inicial (~1,3 MB). |
| Reordenamiento del catálogo con botones ↑/↓ (sort_order 10, 20, …) | Accesible por teclado y usable en móvil. |

## Supuestos

1. **[SUPUESTO]** Acceso a tarea = membresía del tablero (no hay roles de solo lectura). Si la app real tiene un rol
   lector, `task_components` debe restringir INSERT/UPDATE/DELETE a ese rol igual que `tasks`.
2. **[SUPUESTO]** Administración = `profiles.app_role = 'admin'`.
3. `created_by`/`updated_by` referencian `auth.users` sin `ON DELETE` (eliminar un usuario con componentes
   requiere reasignarlos antes). Alternativa: `ON DELETE SET NULL` relajando el NOT NULL.
4. Límites: nombre de tipo ≤ 100, `metadata_type` ≤ 120, nota ≤ 255, HTML del detalle ≤ 100 000 caracteres.
5. La búsqueda usa `LIKE` sobre `lower(component_name)` (índice b-tree para coincidencias exactas). Con volúmenes
   grandes, agregar `pg_trgm` + índice GIN.
6. `src/lib/database.types.ts` se escribió a mano en el formato de `supabase gen types` porque no había Docker
   disponible; **regenerar con `npm run gen:types`** tras `supabase db reset`.

## Archivos

**Base de datos**
- `supabase/migrations/20261101000000_base_kanban_schema.sql` — esquema base de la app (referencia).
- `supabase/migrations/20261110000000_task_components.sql` — **requisito**.
- `supabase/migrations/20261110000100_seed_component_types.sql` — seed idempotente (34 tipos).
- `supabase/rollback/20261110000000_task_components_down.sql` — reversión.
- `supabase/config.toml`, `supabase/seed.sql`.

**Frontend**
- `src/features/components/` — `ComponentsSection`, `ComponentItem`, `ComponentFormModal`, `TypeSelect`,
  `InterventionBadge`, `ComponentSearchPage`, `ComponentTypesAdminPage`, `api.ts`, `types.ts`, `validation.ts`.
- `src/features/export/` — `flatten.ts`, `csv.ts`, `excel.ts`, `pdf.ts`, `ExportMenu.tsx`.
- `src/features/tasks/` — `TaskDetailPanel.tsx` (integra la sección), `TaskHistory.tsx` (diff anterior → nuevo).
- `src/lib/` — `html.ts` (sanitización / texto plano), `errors.ts` (mapeo de errores), `database.types.ts`.
- `src/components/` — `RichTextEditor`, `RichTextView`, `Modal`, `ConfirmDialog`.

**Pruebas**
- `tests/db/task_components.test.ts` (48), `tests/unit/*.test.ts(x)` (61), `tests/e2e/components.spec.ts`.

## Resultado de verificación

| Verificación | Resultado |
|---|---|
| Migraciones aplicadas sobre PostgreSQL (PGlite) | ✅ sin errores; rollback + re-aplicación + seed repetido ✅ |
| `npm run test:db` | ✅ 48/48 |
| `npm run test:unit` | ✅ 61/61 |
| `npm run typecheck` / `npm run build` | ✅ |
| `npm run test:e2e` (Playwright, escritorio + móvil) | ⏳ **No ejecutado**: requiere `supabase start` (Docker no disponible en el equipo de desarrollo). |

### Cobertura de los criterios de aceptación

| # | Criterio | Prueba |
|---|---|---|
| 1 | Registrar PortalEmpresa, badge «Nuevo», contador, persiste | BD «CRUD y criterio 1»; UI «criterio 1»; E2E |
| 2 | Cambio a «Actualizado» con quién/cuándo/anterior/nuevo | BD «historial (criterio 2)»; UI «criterio 2»; E2E |
| 3 | Búsqueda devuelve ambas tareas | BD «búsqueda entre tareas (criterio 3)»; E2E |
| 4 | Usuario sin acceso no obtiene registros vía API | BD «RLS (criterio 4)» — lectura, inserción, edición, borrado, búsqueda e historial |
| 5 | Exportación incluye componentes | Unit «aplanado», «CSV», «Excel» (lectura del .xlsx generado), «PDF» |

### Diferencias con la PGlite vs. Supabase real

Las pruebas de BD usan un *shim* mínimo (`tests/db/supabase-shim.sql`) que emula `auth.users`, `auth.uid()` y los
roles `anon`/`authenticated`. Las migraciones son las mismas que se aplican en Supabase.
