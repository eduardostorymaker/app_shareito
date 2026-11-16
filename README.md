# Shareito

*Cuentas claras, amistades largas.* Aplicación web para registrar gastos personales y compartidos, con liquidación automática por periodos entre los miembros de un grupo.

- **Frontend:** Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend:** Supabase (PostgreSQL con RLS, Auth, Storage, Realtime, pg_cron)
- **Diseño completo:** [`plan.md`](plan.md) · **Base de datos:** [`data_supabase.sql`](data_supabase.sql) · **Marca:** [`brand/README.md`](brand/README.md)

## Puesta en marcha

Requisitos: Node.js 20 o superior y un proyecto de Supabase con `data_supabase.sql` ya ejecutado.

```bash
npm install
cp .env.example .env.local   # y rellena la URL y la clave pública de tu proyecto
npm run dev
```

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (*Project Settings → API*) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (`sb_publishable_…` o `anon`) |
| `NEXT_PUBLIC_SITE_URL` | URL de la app (`http://localhost:3000` en local) |
| `NEXT_PUBLIC_AUTH_GOOGLE` | `true` para mostrar "Continuar con Google" (antes, actívalo en Supabase) |

En Supabase, *Authentication → URL Configuration*: pon la URL de la app como *Site URL* y añade `http://localhost:3000/**` y `https://<tu-dominio>/**` a *Redirect URLs*. Sin eso, los enlaces de confirmación de correo y de recuperación de contraseña no vuelven a la app.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run lint` · `npm run typecheck` | ESLint y TypeScript |
| `npm run test:e2e` | Flujos críticos con Playwright, contra Supabase **local** |
| `npm run db:start` | Levanta Supabase local en Docker |
| `npm run db:types` | Regenera `types/database.ts` desde la base local |

## Tests de extremo a extremo

Se ejecutan contra un Supabase local, nunca contra el proyecto real, porque crean usuarios de prueba.

```bash
npm run db:start                                   # primera vez: descarga las imágenes de Docker
docker exec -i supabase_db_registro-gastos psql -U postgres -d postgres < data_supabase.sql
npx playwright install chromium                    # primera vez
npm run test:e2e
```

Playwright compila y arranca la app en el puerto 3100 con las variables de `.env.e2e` (claves del Supabase local), que tienen prioridad sobre `.env.local`.

Cubren: registro y bienvenida, alta, edición, historial, papelera y restauración de gastos, sesión persistente, panel frente a lista, grupo con invitación, balance en tiempo real entre dos usuarios, cierre automático, bloqueo de gastos cerrados, reapertura, nuevo cierre, pago de transferencias y aislamiento entre usuarios.

## Estructura

```
app/(auth)/        login, registro, recuperar
app/(app)/         pantallas con sesión: inicio, gastos, grupos, panel, ajustes, papelera
app/bienvenida     onboarding
app/invitacion     aceptar invitación a un grupo
app/auth/callback  vuelta de Google y de los enlaces de correo
components/        ui (shadcn), expenses, groups, dashboard, settings, layout, shared
lib/actions/       Server Actions (auth, expenses, groups, settings)
lib/               clientes de Supabase, consultas, formato, errores, auditoría
proxy.ts           refresco de sesión y protección de rutas
tests/e2e/         Playwright
```

## Despliegue en Vercel

1. Sube el repositorio a GitHub. `.env.local` queda fuera por `.gitignore`; `.env.e2e` sí se sube porque solo tiene las claves de demostración del Supabase local.
2. Importa el repositorio en Vercel y añade las variables de la tabla de arriba, con `NEXT_PUBLIC_SITE_URL` apuntando al dominio final.
3. Añade el dominio de Vercel a las *Redirect URLs* de Supabase.
