# Shareito — Plan de proyecto

> Documento maestro para construir la aplicación. Está escrito para que un desarrollador (o un agente de código) pueda implementarla de principio a fin sin contexto adicional.
> La base de datos completa está en [`data_supabase.sql`](data_supabase.sql); este plan la explica pero no la repite.

| | |
|---|---|
| **Producto** | **Shareito**: aplicación web para registrar gastos personales y compartidos. Lema: *Cuentas claras, amistades largas.* |
| **Frontend** | Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui, desplegado en Vercel |
| **Backend** | Supabase: PostgreSQL, Auth, Storage, Realtime |
| **Idioma de la interfaz** | Español (código e identificadores en inglés) |
| **Estado** | Fases 0 a 7 implementadas y probadas de extremo a extremo · ver [§16](#16-decisiones-de-implementación) |

---

## 1. Visión y principios

**Objetivo:** que registrar un gasto cueste menos de 5 segundos, y que un grupo (pareja, piso, familia) sepa en todo momento quién le debe cuánto a quién.

Principios que deciden cualquier duda de diseño:

1. **Registrar es la acción principal.** Todo lo demás (grupos, dashboard, ajustes) está subordinado a ella.
2. **Móvil primero.** Los gastos se anotan en la calle, con una mano.
3. **Nada se pierde.** Todo es editable, todo cambio queda registrado y nada se borra físicamente.
4. **Las reglas viven en la base de datos.** Permisos, validaciones y liquidación están en PostgreSQL (RLS, triggers, funciones). El front no puede saltárselas.
5. **Preparado para IA.** El modelo ya contempla OCR de recibos y entrada por voz sin migraciones disruptivas.

---

## 2. Alcance

### Incluido en la v1

- Registro e inicio de sesión con sesión persistente.
- Alta, edición, borrado lógico y restauración de gastos.
- Gastos **personales** y **compartidos**, con selección por defecto configurable.
- Grupos de gastos: creación, invitación por enlace, roles, salida.
- Cierre contable por grupo: día fijo (1–28) o fin de mes.
- Liquidación: balance en vivo, cierre automático, transferencias sugeridas, marcado de pagos, reapertura.
- Categorías del sistema (17 categorías, 77 subcategorías) más categorías propias y de grupo.
- Dashboard: gasto por categoría, evolución mensual, mayores gastos, comparativas.
- Historial de cambios por gasto y por grupo.
- Adjuntar recibos (foto o PDF) a un gasto.

### Fuera de la v1 (ver [§15](#15-evolución-futura-ia))

OCR de recibos, entrada por voz, reparto no equitativo, multimoneda con tipo de cambio, gastos recurrentes, presupuestos, exportación, notificaciones push.

---

## 3. Stack técnico

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js** última versión estable, App Router, React Server Components | Estándar en Vercel; renderizado en servidor con datos ya autorizados |
| Lenguaje | **TypeScript** en modo `strict` | Tipos generados desde la base de datos |
| Estilos | **Tailwind CSS v4** | Requisito del proyecto |
| Componentes | **shadcn/ui** (Radix) + `lucide-react` | Requisito; accesibles y personalizables |
| Formularios | Estado de React + `zod` | Los esquemas de `lib/validations.ts` validan en el servidor; los formularios son pequeños y no necesitan librería |
| Gráficos | Componentes `chart` de shadcn (Recharts) | Coherencia visual con el resto de la UI |
| Fechas | `date-fns` con locale `es` | Ligero, sin estado global |
| Notificaciones | `sonner` | Toasts con acción "Deshacer" |
| Tema | `next-themes` | Claro / oscuro / sistema |
| Datos | `@supabase/supabase-js` + `@supabase/ssr` | Sesión por cookies compatible con SSR |
| Tests | Vitest (lógica) + Playwright (flujos críticos) | |
| Gestor de paquetes | `npm` | Viene con Node; Vercel lo detecta por `package-lock.json` |

> **Nota de versiones.** Proyecto creado con `create-next-app` (Next.js 16.4, Cache Components activado) y `shadcn init` (Radix, preset Nova), y seguir la guía vigente de Supabase para Next.js. Dos detalles que cambian según versión: el archivo de intercepción de peticiones se llama `proxy.ts` desde Next.js 16 (`middleware.ts` en anteriores), y las claves públicas de Supabase pueden ser del tipo nuevo (`sb_publishable_…`) o `anon` heredado. Ambas funcionan igual.

---

## 4. Arquitectura

```
┌──────────────────────── Navegador / PWA ────────────────────────┐
│  Client Components: formulario de gasto, filtros, gráficos      │
│  Cliente Supabase (browser): Realtime y subida de recibos       │
└───────────────▲──────────────────────────────┬──────────────────┘
                │ HTML/RSC                     │ Server Actions
┌───────────────┴──────────────────────────────▼──────────────────┐
│                      Next.js en Vercel                          │
│  proxy.ts ............ refresca la sesión en cada petición      │
│  Server Components ... lecturas (ya filtradas por RLS)          │
│  Server Actions ...... escrituras, validadas con zod            │
│  Route Handlers ...... /auth/callback (y /api/ai/* en el futuro)│
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS + JWT del usuario
┌───────────────────────────────▼─────────────────────────────────┐
│                           Supabase                              │
│  Auth ......... usuarios y sesiones                             │
│  PostgreSQL ... tablas + RLS + triggers + funciones RPC         │
│  Storage ...... bucket privado `receipts`                       │
│  pg_cron ...... cierre automático de periodos (cada hora)       │
│  Realtime ..... cambios en gastos compartidos                   │
└─────────────────────────────────────────────────────────────────┘
```

### Decisiones de arquitectura

| # | Decisión | Consecuencia |
|---|---|---|
| A1 | **Sin backend propio.** Next.js habla con Supabase usando el JWT del usuario | La seguridad depende de RLS, no del código del front. La `service_role key` no se usa en la v1 |
| A2 | **Lecturas en Server Components, escrituras en Server Actions** | Sin capa de API REST propia. Tras cada escritura, `refresh()` (ver §16) |
| A3 | **Lógica de negocio en PostgreSQL** | La liquidación se calcula igual desde la web, desde pg_cron o desde una futura app móvil |
| A4 | **Borrado lógico en todo** | Gastos con `deleted_at`, grupos y categorías con `archived_at`, miembros con `left_at` |
| A5 | **Errores de negocio con código** | La base lanza `CODIGO: mensaje` (p. ej. `PERIOD_CLOSED: …`); el front traduce el código a un mensaje amable |
| A6 | **Actualización optimista** al guardar un gasto | La UI responde al instante; si falla, se revierte y se avisa |
| A7 | **Tipos generados** con `supabase gen types typescript` | `types/database.ts` nunca se edita a mano |

---

## 5. Modelo de datos

```
auth.users ──1:1── profiles
                      │
        ┌─────────────┼───────────────────────────┐
        │             │                           │
   group_members ── groups ── group_invitations   │
                      │                           │
                      ├── settlements ──┬── settlement_balances
                      │                 └── settlement_transfers
                      │        ▲
   categories ──── expenses ───┘ (settlement_id al cerrar)
   (2 niveles)        │
                      └── expense_attachments ── Storage: receipts

   audit_log  ← triggers de todas las tablas anteriores
```

| Tabla | Propósito | Campos clave |
|---|---|---|
| `profiles` | Perfil y preferencias | `currency`, `timezone`, **`default_scope`**, **`default_group_id`**, `default_payment_method` |
| `groups` | Grupo de gastos compartidos | `currency`, `timezone`, **`closing_type`** (`end_of_month` \| `day_of_month`), **`closing_day`** (1–28 o `NULL`), `close_hold` |
| `group_members` | Pertenencia | `role` (`owner` \| `member`), `left_at` |
| `group_invitations` | Enlaces de invitación | `token`, `max_uses`, `expires_at`, `revoked_at` |
| `categories` | Categorías en dos niveles | `parent_id`, `is_system`, `owner_id`, `group_id`, `icon`, `color` |
| `expenses` | **Tabla central** | `scope` (`personal` \| `shared`), `group_id`, `paid_by`, `amount`, `expense_date`, `category_id`, `settlement_id`, `source`, `deleted_at` |
| `expense_attachments` | Recibos adjuntos | `storage_path`, `kind` |
| `settlements` | Cierre de un periodo | `period_start`, `period_end`, `status` (`closed` \| `reopened`), `total_amount` |
| `settlement_balances` | Foto del balance por persona | `paid`, `share`, `balance` |
| `settlement_transfers` | Quién paga a quién | `from_user`, `to_user`, `amount`, `paid_at` |
| `audit_log` | Historial inmutable | `table_name`, `record_id`, `action`, `old_data`, `new_data`, `changed_fields`, `actor_id` |

Vista `v_expenses`: gastos con nombre de categoría, categoría raíz, grupo, pagador, `split_count` y `share_amount` (la parte de cada participante). **Es la que debe usar el front para listar.**

### Funciones invocables desde el front (`supabase.rpc`)

| Función | Qué hace |
|---|---|
| `get_group_balance(p_group_id)` | Balance en vivo del periodo abierto: total, balance por persona y transferencias sugeridas |
| `close_due_periods(p_group_id, p_release_hold)` | Cierra los periodos vencidos. Llamarla al abrir la pantalla del grupo |
| `reopen_last_period(p_group_id)` | Reabre el último cierre para corregir (solo propietario) |
| `mark_transfer_paid(p_transfer_id, p_paid)` | Marca una transferencia como pagada o pendiente |
| `get_invitation_preview(p_token)` | Datos del grupo antes de aceptar una invitación |
| `accept_group_invitation(p_token)` | Une al usuario al grupo |
| `leave_group(p_group_id)` | Abandona un grupo |
| `dashboard_by_category(p_from, p_to, p_scope, p_group_id, p_full_amount, p_level)` | Gasto agregado por categoría o subcategoría |
| `dashboard_by_month(p_from, p_to, p_scope, p_group_id, p_full_amount)` | Evolución mensual |

### Categorías del sistema

Resultado del análisis de los gastos habituales de una persona. Cada gasto se asigna a una subcategoría; el dashboard agrupa por categoría.

| Categoría | Subcategorías |
|---|---|
| **Vivienda** | Alquiler o hipoteca · Condominio y gastos comunes · Mantenimiento y reparaciones · Muebles y electrodomésticos · Artículos del hogar y limpieza · Seguros e impuestos de vivienda |
| **Servicios básicos** | Electricidad · Agua · Gas · Internet y TV · Telefonía móvil |
| **Alimentación** | Supermercado y mercado · Restaurantes · Delivery · Cafés y snacks · Panadería y tiendas · Bebidas y licores |
| **Transporte** | Combustible · Transporte público · Taxi y apps de movilidad · Estacionamiento y peajes · Mantenimiento del vehículo · Seguro e impuestos del vehículo |
| **Salud** | Consultas médicas · Farmacia · Seguro de salud · Dental · Óptica · Terapia y salud mental · Exámenes y laboratorio |
| **Cuidado personal** | Peluquería y barbería · Higiene y cosmética · Gimnasio y deporte · Spa y bienestar |
| **Ropa y calzado** | Ropa · Calzado · Accesorios y joyería · Lavandería y tintorería |
| **Educación** | Matrícula y pensiones · Cursos y capacitaciones · Libros · Útiles y materiales |
| **Ocio y entretenimiento** | Cine, conciertos y eventos · Streaming y suscripciones · Hobbies · Videojuegos · Bares y vida nocturna · Deportes y actividades |
| **Viajes** | Pasajes · Alojamiento · Tours y actividades · Comidas de viaje · Seguro y trámites |
| **Familia e hijos** | Colegio y guardería · Niñera y cuidado · Juguetes y ropa infantil · Mesadas y apoyo familiar |
| **Mascotas** | Alimento · Veterinario · Accesorios y aseo |
| **Tecnología** | Dispositivos · Software y apps · Accesorios · Nube y servicios web |
| **Finanzas y obligaciones** | Comisiones bancarias · Intereses · Pago de préstamos · Seguros (vida y otros) · Impuestos y trámites |
| **Regalos y donaciones** | Regalos · Donaciones · Celebraciones y fiestas |
| **Trabajo y negocio** | Materiales y herramientas · Servicios profesionales · Oficina y coworking |
| **Otros** | Imprevistos · Sin categoría |

Reglas: las categorías del sistema no se editan. Un usuario puede crear las suyas (solo para gastos personales) y un grupo las suyas (solo para gastos de ese grupo). Un gasto compartido solo admite categorías del sistema o del propio grupo, para que todos los miembros puedan verla.

**Ocultar categorías del sistema (por usuario).** En *Ajustes → Categorías* cada usuario puede desactivar subcategorías del sistema, o una categoría entera desactivando todas las suyas. Se guarda en `hidden_categories` (migración `migrations/002_categorias_ocultas.sql`). Solo cambia el formulario de gasto de ese usuario: gastos, balances, panel, filtros, historial y los demás miembros no se ven afectados. Al editar un gasto cuya categoría está oculta, se conserva y se marca "Oculta para ti". "Otros › Sin categoría" no se puede ocultar.

El campo `icon` guarda el nombre de un icono de `lucide`. El front debe resolverlo con un mapa explícito y un icono de reserva si el nombre no existe.

---

## 6. Reglas de negocio

### 6.1 Gasto personal y compartido

- **Personal:** lo ve y lo edita solo su dueño.
- **Compartido:** pertenece a un grupo. Lo ven y lo pueden editar todos los miembros activos; cada cambio queda en el historial con su autor.
- `paid_by` indica quién pagó. Por defecto, quien registra; en un gasto compartido puede elegirse otro miembro.
- Al abrir el formulario, el tipo viene preseleccionado según `profiles.default_scope` y `default_group_id`. Si el grupo por defecto ya no es válido, se cae a "personal".
- Un grupo opera en **una sola moneda**; la base la impone en cada gasto compartido.

### 6.2 Periodo de cierre

Cada grupo elige cuándo cierra su contabilidad:

| Configuración | `closing_type` | `closing_day` | Periodo |
|---|---|---|---|
| Fin de mes | `end_of_month` | `NULL` | Del día 1 al último día del mes (28, 29, 30 o 31, se calcula solo) |
| Día fijo | `day_of_month` | 1 a 28 | Del día siguiente al cierre anterior hasta el día elegido |

Ejemplo con cierre el día 15: el periodo va del 16 de un mes al 15 del siguiente.

- El primer periodo es el que contiene la fecha de creación del grupo.
- Cada periodo nuevo empieza el día siguiente al último cierre. Por eso cambiar el día de cierre nunca deja huecos ni solapamientos.
- Si al cambiar el día el periodo resultante durara menos de 7 días, se fusiona con el siguiente.
- "Hoy" se evalúa en la zona horaria del grupo.

### 6.3 Cálculo de la liquidación

```
total   = suma de los gastos compartidos del periodo
cuota   = total / número de participantes
balance = lo que pagó cada persona − cuota
          balance > 0  →  le deben
          balance < 0  →  debe
```

**Dos personas.** Ana pagó 300, Beto pagó 100. Total 400, cuota 200. Ana +100, Beto −100. **Beto le paga 100 a Ana.**

**Tres personas** (caso verificado contra la base de datos):

| Persona | Pagó | Cuota | Balance |
|---|---:|---:|---:|
| Ana | 300,00 | 133,33 | +166,67 |
| Beto | 100,01 | 133,34 | −33,33 |
| Caro | 0,00 | 133,34 | −133,34 |

Transferencias: Caro → Ana 133,34 y Beto → Ana 33,33.

Detalles:

- **Participantes:** miembros activos del grupo, más cualquier persona que haya pagado algo en el periodo aunque ya haya salido.
- **Redondeo:** la cuota se redondea a 2 decimales y el céntimo sobrante se asigna a quien más pagó, de modo que los balances siempre suman exactamente 0.
- **Transferencias mínimas:** se empareja al mayor deudor con el mayor acreedor hasta saldar todo.
- Quien entra a mitad de periodo participa en todos los gastos abiertos de ese periodo. La interfaz debe avisarlo al invitar.

### 6.4 Cierre, bloqueo y reapertura

1. Pasada la fecha de cierre, el periodo se cierra solo: `pg_cron` cada hora y, como respaldo, el front llama a `close_due_periods` al abrir el grupo.
2. Al cerrar se guarda una foto: `settlements`, `settlement_balances` y `settlement_transfers`. Los gastos incluidos reciben `settlement_id`.
3. **Un gasto de un periodo cerrado queda bloqueado**: no se puede editar ni borrar, y no se pueden crear gastos con fecha dentro de un periodo cerrado.
4. Para corregir, un propietario **reabre el último periodo** (`reopen_last_period`). El cierre anterior permanece en el historial con estado `reopened`, los gastos se desbloquean y el cierre automático se pausa (`close_hold`).
5. Hecha la corrección, el propietario vuelve a cerrar con `close_due_periods(grupo, true)`, lo que genera una nueva foto.
6. Cada transferencia se marca como pagada cuando el dinero cambia de manos.

### 6.5 Trazabilidad

- Un trigger genérico registra en `audit_log` cada alta, cambio o baja de todas las tablas de negocio: valor anterior, valor nuevo, campos cambiados, autor y momento.
- El borrado de un gasto es lógico y aparece como `SOFT_DELETE`; restaurarlo aparece como `RESTORE`.
- `audit_log` es de solo lectura para los usuarios: nadie puede alterar el historial.
- En la interfaz: pestaña "Historial" en el detalle de cada gasto, registro de actividad en cada grupo y "Papelera" para restaurar.

---

## 7. Seguridad

| Medida | Implementación |
|---|---|
| Aislamiento de datos | **RLS activado en todas las tablas.** Un usuario solo ve sus gastos personales y los de los grupos donde es miembro activo |
| Sin acceso anónimo | El rol `anon` no tiene privilegios sobre ninguna tabla ni función |
| Privilegios por columna | El usuario no puede escribir campos como `settlement_id`, `created_by`, `close_hold` o `is_system` |
| Escrituras sensibles | Cierres, balances, transferencias, membresías y auditoría solo se escriben mediante funciones `SECURITY DEFINER` con comprobación de permisos |
| Funciones internas | En el esquema `private`, no expuesto por la API |
| Recibos | Bucket privado, 10 MB máximo, solo imágenes y PDF; se sirven con URL firmada de corta duración |
| Claves | En el navegador solo la URL y la clave pública. La `service_role key` no se usa ni se sube a Vercel en la v1 |
| Validación | `zod` en cliente y servidor, más restricciones `CHECK` y triggers en la base |
| Servidor | Identificar al usuario con `supabase.auth.getUser()` o `getClaims()`, nunca confiando en `getSession()` |

---

## 8. Autenticación y sesión persistente

**Requisito:** el usuario no debe volver a iniciar sesión.

Cómo se consigue:

1. **Supabase Auth no caduca las sesiones por defecto.** El token de acceso dura 1 hora, pero el token de refresco no expira y se renueva solo. La sesión termina únicamente al cerrar sesión o cambiar la contraseña.
2. **No activar** en *Authentication → Sessions* ni "Time-box user sessions" ni "Inactivity timeout". Deben quedar en 0 (nunca).
3. **`proxy.ts` refresca la sesión en cada petición** y reescribe las cookies desde el servidor con `maxAge` de 400 días (el máximo que admiten los navegadores). Cada visita reinicia ese plazo.
4. Las cookies se escriben **desde el servidor**. Safari limita a 7 días las que se crean desde JavaScript, pero no las de servidor.
5. **PWA instalable** (manifest + iconos): la app queda en la pantalla de inicio del móvil y abre directa al registro.

Métodos de acceso: correo y contraseña, y Google (OAuth). Recuperación de contraseña por correo.

Rutas: todo bajo `(app)` exige sesión; sin ella se redirige a `/login?next=…`. Un usuario con sesión que visita `/login` va a `/`.

---

## 9. UX / UI

### 9.1 Principios

1. **Tres toques para un gasto:** importe → categoría → guardar. Lo demás tiene un valor por defecto sensato.
2. **Valores por defecto inteligentes:** fecha de hoy, tipo según ajustes, método de pago habitual, categorías usadas recientemente primero.
3. **Zona del pulgar:** las acciones principales están abajo. Objetivos táctiles de 44 px como mínimo.
4. **Perdonar errores:** borrar muestra un toast con "Deshacer" en lugar de un diálogo de confirmación.
5. **Claridad financiera:** importes con cifras tabulares, moneda siempre visible, y lenguaje directo: "Le debes S/ 45,00 a Ana", no "Balance: −45".
6. **Nunca una pantalla vacía sin guía:** cada estado vacío explica qué hacer y ofrece el botón para hacerlo.

### 9.2 Navegación

**Móvil:** barra inferior con cinco posiciones y un botón central destacado.

```
┌───────────────────────────────────────────┐
│  Inicio   Gastos   ( + )   Grupos   Panel │
└───────────────────────────────────────────┘
```

**Escritorio (≥ 1024 px):** barra lateral con las mismas secciones y botón "Nuevo gasto" arriba. Atajo de teclado `N`.

Ajustes se abre desde el avatar.

### 9.3 Mapa de pantallas

| Ruta | Pantalla | Contenido |
|---|---|---|
| `/login`, `/registro`, `/recuperar` | Acceso | Formulario mínimo y botón de Google |
| `/bienvenida` | Onboarding (una vez) | Nombre, moneda, zona horaria detectada, tipo de gasto por defecto |
| `/` | Inicio | Total del mes, lo que debo y me deben por grupo, últimos gastos |
| `/gastos` | Lista | Agrupada por día, búsqueda y filtros (fechas, tipo, grupo, categoría, pagador) |
| `/gastos/[id]` | Detalle | Datos, recibos, pestaña **Historial**, editar y borrar |
| `/grupos` | Mis grupos | Tarjeta por grupo con mi balance actual |
| `/grupos/[id]` | Grupo | Periodo abierto, balance por persona, "quién paga a quién", gastos del periodo, cierres anteriores, actividad |
| `/grupos/[id]/cierres/[sid]` | Cierre | Foto del periodo y transferencias con su estado de pago |
| `/panel` | Dashboard | Ver [§9.6](#96-dashboard) |
| `/ajustes` | Ajustes | Perfil, preferencias, categorías, grupos, cerrar sesión |
| `/ajustes/grupos/[id]` | Configurar grupo | Nombre, **día de cierre**, miembros y roles, invitaciones, archivar |
| `/papelera` | Papelera | Gastos borrados, con "Restaurar" |
| `/invitacion/[token]` | Invitación | Vista previa del grupo y botón "Unirme" |

### 9.4 Flujo estrella: registrar un gasto

Panel inferior en móvil (`Drawer`), diálogo en escritorio (`Dialog`). Se abre desde el botón `+` en cualquier pantalla.

```
┌──────────────────────────────────────┐
│  Nuevo gasto                       ✕ │
│                                      │
│              S/ 45,00                │  ← foco automático, teclado numérico
│                                      │
│  [  Personal  |  Compartido · Casa ] │  ← preseleccionado según ajustes
│                                      │
│  Categoría                           │
│  (🛒 Súper) (🍽 Rest.) (⛽ Comb.) …  │  ← recientes primero, luego todas
│                                      │
│  Hoy ▾     Efectivo ▾     Nota…      │  ← opcionales, con valor por defecto
│  Pagó: Yo ▾                          │  ← solo si es compartido
│  📎 Adjuntar recibo                  │
│                                      │
│  [           Guardar            ]    │
│  Guardar y añadir otro               │
└──────────────────────────────────────┘
```

- El selector de tipo es un control segmentado. Con varios grupos, "Compartido" despliega cuál.
- Selector de categoría: fila de recientes, y debajo cuadrícula de categorías que abre sus subcategorías; con búsqueda.
- Al guardar: el panel se cierra, el gasto aparece al instante en la lista y un toast confirma con "Deshacer".
- Editar reutiliza exactamente el mismo formulario.
- Si el gasto está bloqueado por un cierre, los campos se muestran en solo lectura con el aviso "Periodo cerrado" y, para propietarios, el botón "Reabrir periodo".

### 9.5 Pantalla de grupo

Orden vertical, de lo más importante a lo menos:

1. **Mi situación**, en una frase grande: "Le debes S/ 45,00 a Ana", "Te deben S/ 120,00" o "Estáis en paz".
2. **Periodo abierto:** fechas, días restantes y total gastado.
3. **Balance por persona:** pagó, le corresponde, diferencia.
4. **Transferencias sugeridas.**
5. **Gastos del periodo.**
6. **Cierres anteriores**, con el estado de pago de cada uno.

Al entrar se llama a `close_due_periods`. Si hay un periodo reabierto se muestra un aviso persistente con el botón "Volver a cerrar".

### 9.6 Dashboard

Filtros globales: periodo (este mes, mes pasado, 3 meses, año, personalizado), tipo (todo, personal, compartido) y grupo. Selector "Mi parte / Total del grupo" cuando hay gastos compartidos.

| Bloque | Visualización | Fuente |
|---|---|---|
| Indicadores | Total, promedio diario, número de gastos, variación frente al periodo anterior | `dashboard_by_month` |
| Gasto por categoría | Barras horizontales ordenadas, de una sola tinta, con icono, importe y porcentaje; al tocar una categoría se desglosan sus subcategorías | `dashboard_by_category` |
| Ranking de categorías | Barras horizontales ordenadas, con porcentaje | `dashboard_by_category` |
| Evolución | Barras por mes | `dashboard_by_month` |
| Mayores gastos | Lista de los 10 más altos | `v_expenses` ordenada por importe |
| Personal frente a compartido | Barra apilada | `dashboard_by_month` por tipo |
| Por método de pago | Barras | `v_expenses` |

"Mi parte" usa `share_amount`: el importe completo de los gastos personales y la fracción que corresponde al usuario en los compartidos. Si hay varias monedas, se muestran por separado; nunca se suman.

### 9.7 Sistema de diseño

- **Marca:** ver [`brand/README.md`](brand/README.md): logotipo de billetera en línea, paleta Índigo (`#5038E0`) con rosa `#FF7EB6` solo en el símbolo.
- **Base:** shadcn/ui (Radix, preset Nova) con los tokens de la paleta Índigo en `app/globals.css`; neutros con un matiz del primario.
- **Tipografía:** Plus Jakarta Sans para titulares y cifras destacadas, Inter para el texto; importes alineados con `tabular-nums`.
- **Color con significado:** verde para "te deben", rojo para "debes", ámbar para avisos. Nunca solo color: siempre acompañado de texto o icono.
- **Categorías:** icono sobre un círculo con el color de la categoría al 15 % de opacidad.
- **Modo oscuro** desde el primer día.
- **Formato:** `Intl.NumberFormat` e `Intl.DateTimeFormat` según el perfil del usuario.
- **Accesibilidad:** objetivo WCAG 2.1 AA. Contraste 4,5:1, foco visible, navegación completa por teclado, etiquetas en todos los controles, respeto a `prefers-reduced-motion`.
- **Estados:** toda vista con datos define carga (esqueleto), vacío, error y contenido.

Componentes shadcn previstos: `button`, `input`, `label`, `form`, `select`, `dialog`, `drawer`, `sheet`, `tabs`, `toggle-group`, `card`, `badge`, `avatar`, `dropdown-menu`, `popover`, `calendar`, `command`, `skeleton`, `sonner`, `chart`, `table`, `alert`, `separator`, `scroll-area`, `tooltip`.

---

## 10. Estructura del proyecto

```
.
├── plan.md
├── data_supabase.sql
├── .env.local                     # no se sube a git
├── .env.example
├── proxy.ts                       # refresco de sesión y protección de rutas
├── app/
│   ├── layout.tsx                 # fuentes, tema, toaster
│   ├── manifest.ts                # PWA
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── registro/page.tsx
│   │   └── recuperar/page.tsx
│   ├── auth/callback/route.ts     # intercambio de código (OAuth y correo)
│   ├── invitacion/[token]/page.tsx
│   └── (app)/
│       ├── layout.tsx             # navegación + botón de nuevo gasto
│       ├── page.tsx               # Inicio
│       ├── bienvenida/page.tsx
│       ├── gastos/page.tsx
│       ├── gastos/[id]/page.tsx
│       ├── grupos/page.tsx
│       ├── grupos/[id]/page.tsx
│       ├── grupos/[id]/cierres/[sid]/page.tsx
│       ├── panel/page.tsx
│       ├── papelera/page.tsx
│       └── ajustes/…
├── components/
│   ├── ui/                        # shadcn (generado)
│   ├── layout/                    # bottom-nav, sidebar, user-menu
│   ├── expenses/                  # expense-form, expense-list, category-picker, scope-toggle
│   ├── groups/                    # balance-card, transfer-list, member-list, closing-day-picker
│   ├── dashboard/                 # charts, kpi-cards, filtros
│   └── shared/                    # money, empty-state, category-icon
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # cliente de navegador
│   │   ├── server.ts              # cliente de servidor (cookies)
│   │   └── proxy.ts               # updateSession
│   ├── actions/                   # Server Actions: expenses, groups, categories, profile
│   ├── queries/                   # lecturas reutilizables para Server Components
│   ├── validations/               # esquemas zod
│   ├── errors.ts                  # código de error de la base → mensaje en español
│   ├── format.ts                  # dinero y fechas
│   ├── periods.ts                 # textos de periodos de cierre
│   └── category-icons.ts          # nombre → icono lucide, con reserva
├── types/
│   └── database.ts                # generado por Supabase
└── tests/
```

### Convenciones

- Server Components por defecto; `"use client"` solo donde haya interacción.
- Toda Server Action: valida con zod → llama a Supabase → traduce el error con `lib/errors.ts` → `refresh()` → devuelve `{ ok: true, data } | { ok: false, code, message }`.
- Los importes llegan de PostgreSQL como `number`. Para sumar en el cliente, operar en céntimos enteros; las agregaciones importantes ya vienen calculadas de la base.
- Las fechas de gasto son `date` sin hora: tratarlas como texto `YYYY-MM-DD`, nunca convertirlas con `new Date()` sin zona.
- El `id` del gasto se genera en el cliente (`crypto.randomUUID()`) para poder subir el recibo y pintar la fila antes de la respuesta.
- Recibos: subir a `receipts/{user_id}/{expense_id}/{archivo}` y después insertar la fila en `expense_attachments`.

### Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clave pública>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 11. Plan de implementación

Cada fase termina con la aplicación funcionando y desplegable. No empezar una fase sin cumplir los criterios de la anterior.

### Fase 0 — Cimientos
- Crear proyecto Next.js, Tailwind, shadcn, ESLint, Prettier.
- Ejecutar `data_supabase.sql` en Supabase y generar `types/database.ts`.
- Clientes de Supabase y `proxy.ts`.
- Layout base, tema claro/oscuro, manifest PWA.

**Hecho cuando:** la app arranca, lee las categorías del sistema desde Supabase y `npm run build` pasa sin errores.

### Fase 1 — Acceso y sesión
- Registro, inicio de sesión, Google, recuperación de contraseña, `/auth/callback`.
- Protección de rutas y onboarding.

**Hecho cuando:** un usuario nuevo se registra, completa la bienvenida y sigue con sesión tras cerrar el navegador y esperar más de una hora.

### Fase 2 — Gastos personales
- Formulario de gasto con selector de categoría.
- Lista con filtros, detalle, edición, borrado con "Deshacer", papelera.

**Hecho cuando:** registrar un gasto cuesta tres toques y aparece al instante; editar y restaurar funcionan.

### Fase 3 — Grupos y gastos compartidos
- Crear grupo, configurar día de cierre, invitar por enlace, aceptar, salir, roles.
- Selector de tipo en el formulario, con el valor por defecto de ajustes.
- Realtime en la lista de gastos del grupo.

**Hecho cuando:** dos usuarios en navegadores distintos comparten un grupo y cada uno ve los gastos del otro sin recargar.

### Fase 4 — Liquidación
- Pantalla de grupo: balance en vivo y transferencias sugeridas.
- Cierre de periodos, historial de cierres, marcado de pagos, reapertura.
- Bloqueo visual de gastos cerrados.

**Hecho cuando:** los importes de la pantalla coinciden con los ejemplos de [§6.3](#63-cálculo-de-la-liquidación) y un gasto de un periodo cerrado no se puede editar hasta reabrirlo.

### Fase 5 — Dashboard
- Indicadores, gráficos y filtros de [§9.6](#96-dashboard).

**Hecho cuando:** los totales del dashboard coinciden con la suma de la lista de gastos para el mismo filtro.

### Fase 6 — Trazabilidad y ajustes
- Historial por gasto y actividad por grupo.
- Ajustes: perfil, preferencias, categorías propias y de grupo.
- Adjuntar recibos.

**Hecho cuando:** cada edición muestra quién cambió qué, de qué valor a cuál y cuándo.

### Fase 7 — Calidad y despliegue
- Estados de carga, vacío y error en todas las vistas; `error.tsx` y `not-found.tsx`.
- Revisión de accesibilidad y de rendimiento en móvil.
- Tests y despliegue en Vercel.

**Hecho cuando:** Lighthouse móvil ≥ 90 en rendimiento y accesibilidad, y los flujos críticos pasan en Playwright.

### Pruebas mínimas

| Tipo | Qué cubre |
|---|---|
| Unitarias (Vitest) | Formato de dinero y fechas, textos de periodos, traducción de errores, esquemas zod |
| Flujos (Playwright) | Registro → primer gasto · crear grupo → invitar → gasto compartido → balance · cierre → bloqueo → reapertura |
| Seguridad (manual, con dos cuentas) | Un usuario no ve gastos personales de otro · un no miembro no ve nada del grupo · no se puede editar un gasto cerrado |

---

## 12. Configuración de Supabase

1. Crear el proyecto y elegir la región más cercana a los usuarios.
2. **SQL Editor →** pegar `data_supabase.sql` completo → **Run**. Es idempotente; puede repetirse.
3. Comprobar: `select count(*) from public.categories;` debe devolver **94**.
4. **Authentication → Sessions:** "Time-box user sessions" e "Inactivity timeout" en 0.
5. **Authentication → URL Configuration:** *Site URL* con el dominio de producción; en *Redirect URLs*, `http://localhost:3000/**` y `https://<dominio>/**`.
6. **Authentication → Providers:** activar Email y, si se desea, Google.
7. **Database → Extensions:** confirmar que `pg_cron` está activo. Si no lo estaba al ejecutar el script, activarlo y volver a ejecutarlo. Sin `pg_cron` la app funciona igual: los periodos se cierran al abrir el grupo.
8. Generar tipos: `npx supabase gen types typescript --project-id <id> > types/database.ts` (o `npm run db:types` contra el Supabase local).

---

## 13. Despliegue

1. Subir el repositorio a GitHub. `.env.local` debe estar en `.gitignore`.
2. En Vercel: importar el repositorio (detecta Next.js automáticamente).
3. Añadir las tres variables de entorno de [§10](#variables-de-entorno), con `NEXT_PUBLIC_SITE_URL` apuntando al dominio final.
4. Desplegar y añadir el dominio de Vercel a las *Redirect URLs* de Supabase.
5. Probar en producción: registro, inicio de sesión con Google, un gasto y una invitación.

---

## 14. Decisiones tomadas y límites conocidos

Decisiones de producto adoptadas para la v1. Cualquiera puede cambiarse; se indica el coste.

| Decisión | Alternativa | Coste del cambio |
|---|---|---|
| Reparto **a partes iguales** entre todos los miembros | Porcentajes o reparto por gasto | Medio: tabla `expense_splits` y ajuste del cálculo |
| **Cualquier miembro** puede editar los gastos compartidos (queda auditado) | Solo el autor o el propietario | Bajo: una política RLS |
| **Una moneda por grupo**, sin conversión | Multimoneda con tipo de cambio | Alto |
| Periodos cerrados **bloqueados**, con reapertura por el propietario | Edición libre con recálculo | Medio |
| Solo se reabre el **último** periodo | Reabrir cualquiera | Alto: rompe la cadena de periodos |
| Invitación por **enlace** | Invitación por correo | Bajo: requiere envío de correos |

Límites conocidos:

- **Salir de un grupo con el periodo abierto:** quien sale sin haber pagado nada deja de contar en el reparto. La interfaz debe recomendar cerrar el periodo antes.
- **Eliminar una cuenta** con gastos registrados está impedido por integridad referencial. La baja de usuarios (con anonimización) queda fuera de la v1.
- **En el dashboard**, "mi parte" de un gasto compartido aún no cerrado se calcula con los miembros actuales del grupo.

---

## 15. Evolución futura: IA

El modelo ya está preparado: `expenses.source` (`manual`, `ocr`, `voice`, `import`, `recurring`), `expenses.source_metadata` (JSON) y `expense_attachments.kind` (`receipt`, `audio`).

| Función | Enfoque |
|---|---|
| **OCR de recibos** | El usuario fotografía el recibo → se sube a Storage → un Route Handler (`/api/ai/receipt`) envía la imagen a un modelo con visión → devuelve importe, fecha, comercio y categoría sugerida |
| **Entrada por voz** | Grabación en el navegador → transcripción (Whisper) → un modelo extrae los campos de frases como "cuarenta y cinco soles en el súper, compartido" |
| **Categorización automática** | Sugerir categoría a partir del comercio y del historial del usuario |
| **Gastos recurrentes** | Alquiler, suscripciones: plantilla más tarea programada |
| **Otros** | Presupuestos por categoría con alertas, exportación a CSV/Excel, notificaciones de cierre |

Principio común a todas las funciones de IA: **la IA propone y el usuario confirma.** El resultado rellena el mismo formulario de gasto, que el usuario revisa antes de guardar. Las claves de los proveedores de IA viven solo en el servidor.

---

## 16. Decisiones de implementación

Cambios respecto al plan original, con su motivo. El resto se construyó tal como está descrito.

| Tema | Plan | Implementado | Motivo |
|---|---|---|---|
| Gráfico por categoría | Dona | Barras horizontales ordenadas | Con 17 categorías una dona no permite comparar valores parecidos; las barras sobre una misma base sí, y el importe y el porcentaje van escritos |
| Personal frente a compartido | Barra apilada | Barra segmentada fina con leyenda e importes | Dos partes de un mismo total. Colores validados para daltonismo en claro y oscuro |
| Formularios | `react-hook-form` | Estado de React + `zod` en el servidor | Formularios cortos; una dependencia menos |
| Gestor de paquetes | `pnpm` | `npm` | `pnpm` no estaba instalado; no cambia nada en Vercel |
| Datos en Server Components | Lectura directa | `connection()` antes de crear el cliente de Supabase | Con Cache Components, el cliente de Supabase usa `Date.now()`, que no se admite en el prerenderizado |
| Prefetch por sesión | — | `partialPrefetching: false` | Todo el contenido depende de la sesión, así que el prefetch por sesión no adelanta nada |
| Refresco tras una acción | `revalidatePath` | `refresh()` en las Server Actions | `revalidatePath("/", "layout")` invalidaba los armazones estáticos de todas las rutas; regenerarlos tardaba unos 10 s y la acción siguiente del usuario quedaba en cola. No hay datos cacheados en el servidor, así que basta con refrescar la vista |
| Realtime | Suscripción simple | Se pasa el token de la sesión al canal antes de suscribirse | Sin eso, el navegador se une como anónimo y la RLS no entrega los cambios |
| Categorías recientes en el formulario | — | Se fijan al abrir el formulario | Evita que los chips se muevan si el servidor revalida con el formulario abierto |
| Tests | Vitest + Playwright | Playwright (3 flujos) contra Supabase local | Los flujos críticos cubren la lógica de mayor riesgo de punta a punta; Vitest queda pendiente para utilidades |

### Pendiente

- Marca aplicada: ver [`brand/README.md`](brand/README.md).
- Tests unitarios con Vitest de `lib/format.ts`, `lib/ranges.ts` y `lib/errors.ts`.
- Revisión con Lighthouse en el despliegue real (objetivo ≥ 90 en móvil).
- Probar en el proyecto real el inicio con Google, la confirmación de correo y la recuperación de contraseña, que dependen de la configuración de Supabase (*URL Configuration* y proveedor de Google).

