-- =============================================================================
--  REGISTRO DE GASTOS  ·  Esquema completo para Supabase (PostgreSQL 15+)
-- =============================================================================
--  Cómo usarlo
--    1. Crea el proyecto en Supabase.
--    2. SQL Editor  ->  pega este archivo completo  ->  Run.
--    3. El script es idempotente: puede ejecutarse varias veces sin duplicar.
--
--  Contenido
--    01  Esquema privado
--    02  Tablas
--    03  Índices
--    04  Funciones auxiliares (RLS, periodos de cierre)
--    05  Triggers (perfil, validación de gastos, auditoría, timestamps)
--    06  Liquidación de gastos compartidos (balances, transferencias, cierre)
--    07  RPC públicas (invocables desde el front con supabase.rpc)
--    08  Vista y funciones de dashboard
--    09  Row Level Security
--    10  Privilegios (GRANT / REVOKE)
--    11  Storage (bucket de recibos)
--    12  Datos semilla: categorías del sistema
--    13  Cierre automático con pg_cron y Realtime (opcionales, tolerantes a fallo)
--    14  Categorías del sistema ocultas por usuario (= migrations/002)
--
--  Convenciones
--    · Identificadores en inglés, snake_case. Textos visibles en español.
--    · Importes en numeric(12,2). Nunca float.
--    · Nada se borra físicamente: gastos con soft delete (deleted_at),
--      grupos y categorías con archived_at, miembros con left_at.
--    · Los errores de negocio se lanzan con un código al inicio del mensaje
--      (p. ej. 'PERIOD_CLOSED: ...') para que el front los traduzca.
-- =============================================================================


-- =============================================================================
-- 01  ESQUEMA PRIVADO
--     Funciones internas que no deben quedar expuestas por la Data API.
-- =============================================================================
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;


-- =============================================================================
-- 02  TABLAS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: datos públicos y preferencias de cada usuario (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  email                   text not null default '',
  display_name            text not null default '',
  avatar_url              text,
  currency                text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  locale                  text not null default 'es',
  timezone                text not null default 'UTC',
  -- Selección por defecto al registrar un gasto (configurable por el usuario)
  default_scope           text not null default 'personal'
                          check (default_scope in ('personal', 'shared')),
  default_group_id        uuid,
  default_payment_method  text not null default 'cash'
                          check (default_payment_method in
                            ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'digital_wallet', 'other')),
  onboarded_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
comment on table public.profiles is 'Perfil y preferencias del usuario. Se crea automáticamente al registrarse.';

-- ---------------------------------------------------------------------------
-- groups: grupos para compartir gastos
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 60),
  description   text,
  icon          text not null default 'users',
  color         text not null default '#6366F1',
  currency      text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  timezone      text not null default 'UTC',
  -- Cierre contable: fin de mes (sin número) o un día fijo del 1 al 28
  closing_type  text not null default 'end_of_month'
                check (closing_type in ('end_of_month', 'day_of_month')),
  closing_day   smallint,
  -- true tras reabrir un periodo: pausa el cierre automático hasta volver a cerrar
  close_hold    boolean not null default false,
  created_by    uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint groups_closing_ck check (
    (closing_type = 'end_of_month' and closing_day is null)
    or (closing_type = 'day_of_month' and closing_day between 1 and 28)
  )
);
comment on column public.groups.closing_day is 'Día de cierre 1..28. NULL cuando closing_type = end_of_month.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_default_group_fk') then
    alter table public.profiles
      add constraint profiles_default_group_fk
      foreign key (default_group_id) references public.groups (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- group_members: pertenencia a grupos
-- ---------------------------------------------------------------------------
create table if not exists public.group_members (
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete restrict,
  role        text not null default 'member' check (role in ('owner', 'member')),
  invited_by  uuid references public.profiles (id) on delete set null,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  primary key (group_id, user_id)
);

-- ---------------------------------------------------------------------------
-- group_invitations: enlaces de invitación a un grupo
-- ---------------------------------------------------------------------------
create table if not exists public.group_invitations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  token       text not null unique
              default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  max_uses    integer not null default 1 check (max_uses >= 1),
  used_count  integer not null default 0,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  revoked_at  timestamptz,
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories: dos niveles (categoría -> subcategoría)
--   · Sistema:   is_system = true,  owner_id NULL, group_id NULL
--   · Personal:  owner_id = usuario, group_id NULL
--   · De grupo:  owner_id = creador, group_id = grupo
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles (id) on delete restrict,
  group_id    uuid references public.groups (id) on delete cascade,
  parent_id   uuid references public.categories (id) on delete restrict,
  slug        text,
  name        text not null check (char_length(name) between 1 and 60),
  icon        text not null default 'circle',
  color       text not null default '#9CA3AF',
  sort_order  integer not null default 0,
  is_system   boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_owner_ck check (
    (is_system and owner_id is null and group_id is null)
    or (not is_system and owner_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- settlements: cierres (liquidaciones) de un periodo de un grupo
-- ---------------------------------------------------------------------------
create table if not exists public.settlements (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'closed' check (status in ('closed', 'reopened')),
  closing_type  text not null,
  closing_day   smallint,
  currency      text not null,
  total_amount  numeric(14,2) not null default 0,
  member_count  integer not null default 0,
  closed_at     timestamptz not null default now(),
  closed_by     uuid references public.profiles (id) on delete set null, -- NULL = cierre automático
  reopened_at   timestamptz,
  reopened_by   uuid references public.profiles (id) on delete set null,
  constraint settlements_period_ck check (period_end >= period_start)
);

-- Foto del balance de cada participante al cerrar
create table if not exists public.settlement_balances (
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete restrict,
  paid          numeric(14,2) not null,  -- lo que pagó en el periodo
  share         numeric(14,2) not null,  -- lo que le corresponde (total / participantes)
  balance       numeric(14,2) not null,  -- paid - share  (>0 le deben, <0 debe)
  primary key (settlement_id, user_id)
);

-- Transferencias sugeridas para saldar el periodo ("quién le paga a quién")
create table if not exists public.settlement_transfers (
  id            uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id) on delete cascade,
  from_user     uuid not null references public.profiles (id) on delete restrict,
  to_user       uuid not null references public.profiles (id) on delete restrict,
  amount        numeric(14,2) not null check (amount > 0),
  paid_at       timestamptz,
  marked_by     uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- expenses: el gasto. Tabla central.
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null default 'personal' check (scope in ('personal', 'shared')),
  group_id        uuid references public.groups (id) on delete restrict,
  paid_by         uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  category_id     uuid not null references public.categories (id) on delete restrict,
  amount          numeric(12,2) not null check (amount > 0),
  -- Sin default: si no se envía, el trigger usa la moneda del grupo o la del perfil
  currency        text not null check (currency ~ '^[A-Z]{3}$'),
  description     text check (char_length(description) <= 200),
  merchant        text check (char_length(merchant) <= 120),
  expense_date    date not null default current_date,
  payment_method  text not null default 'cash'
                  check (payment_method in
                    ('cash', 'debit_card', 'credit_card', 'bank_transfer', 'digital_wallet', 'other')),
  notes           text,
  -- Preparado para IA: origen del registro y metadatos (confianza OCR, transcripción...)
  source          text not null default 'manual'
                  check (source in ('manual', 'ocr', 'voice', 'import', 'recurring')),
  source_metadata jsonb,
  -- Se rellena al cerrar el periodo; un gasto liquidado queda bloqueado
  settlement_id   uuid references public.settlements (id) on delete set null,
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null,
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references public.profiles (id) on delete set null,
  constraint expenses_scope_group_ck check (
    (scope = 'personal' and group_id is null)
    or (scope = 'shared' and group_id is not null)
  )
);
comment on column public.expenses.paid_by is 'Quién pagó. En gastos personales siempre es el propio usuario.';

-- ---------------------------------------------------------------------------
-- expense_attachments: recibos y (futuro) audios asociados a un gasto
-- ---------------------------------------------------------------------------
create table if not exists public.expense_attachments (
  id            uuid primary key default gen_random_uuid(),
  expense_id    uuid not null references public.expenses (id) on delete cascade,
  storage_path  text not null unique,   -- receipts/{user_id}/{expense_id}/{archivo}
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  kind          text not null default 'receipt' check (kind in ('receipt', 'audio', 'other')),
  created_by    uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log: historial inmutable de cambios (trazabilidad)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id             bigint generated always as identity primary key,
  table_name     text not null,
  record_id      uuid,
  action         text not null,   -- INSERT | UPDATE | DELETE | SOFT_DELETE | RESTORE
  old_data       jsonb,
  new_data       jsonb,
  changed_fields text[],
  actor_id       uuid,            -- quién hizo el cambio (NULL = sistema / cierre automático)
  owner_id       uuid,            -- dueño del registro (para RLS)
  group_id       uuid,            -- grupo relacionado (para RLS)
  created_at     timestamptz not null default now()
);


-- =============================================================================
-- 03  ÍNDICES
-- =============================================================================
create index if not exists expenses_personal_idx
  on public.expenses (paid_by, expense_date desc) where deleted_at is null;
create index if not exists expenses_group_idx
  on public.expenses (group_id, expense_date desc) where scope = 'shared' and deleted_at is null;
create index if not exists expenses_unsettled_idx
  on public.expenses (group_id, expense_date) where scope = 'shared' and settlement_id is null and deleted_at is null;
create index if not exists expenses_category_idx   on public.expenses (category_id);
create index if not exists expenses_settlement_idx on public.expenses (settlement_id);
create index if not exists expenses_created_by_idx on public.expenses (created_by);

create index if not exists group_members_user_idx on public.group_members (user_id) where left_at is null;
create index if not exists group_invitations_group_idx on public.group_invitations (group_id);

create index if not exists categories_owner_idx  on public.categories (owner_id) where owner_id is not null;
create index if not exists categories_group_idx  on public.categories (group_id) where group_id is not null;
create index if not exists categories_parent_idx on public.categories (parent_id);
create unique index if not exists categories_system_slug_uidx on public.categories (slug) where is_system;

create index if not exists settlements_group_idx on public.settlements (group_id, period_end desc);
create unique index if not exists settlements_closed_uidx
  on public.settlements (group_id, period_end) where status = 'closed';
create index if not exists settlement_transfers_settlement_idx on public.settlement_transfers (settlement_id);

create index if not exists expense_attachments_expense_idx on public.expense_attachments (expense_id);

create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);
create index if not exists audit_log_group_idx  on public.audit_log (group_id, created_at desc) where group_id is not null;
create index if not exists audit_log_owner_idx  on public.audit_log (owner_id, created_at desc);


-- =============================================================================
-- 04  FUNCIONES AUXILIARES
-- =============================================================================

-- ¿El usuario actual es miembro activo del grupo?
create or replace function private.is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
      and gm.left_at is null
  );
$$;

-- ¿El usuario actual es propietario (administrador) del grupo?
create or replace function private.is_group_owner(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = (select auth.uid())
      and gm.left_at is null
      and gm.role = 'owner'
  );
$$;

-- ¿El usuario actual comparte (o compartió) algún grupo con p_user_id?
-- Permite ver nombre y avatar de los compañeros de grupo.
create or replace function private.shares_group_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members other on other.group_id = me.group_id
    where me.user_id = (select auth.uid())
      and me.left_at is null
      and other.user_id = p_user_id
  );
$$;

-- Primera fecha de cierre >= p_from según la configuración del grupo
create or replace function private.next_closing_date(p_type text, p_day smallint, p_from date)
returns date
language plpgsql immutable set search_path = ''
as $$
declare
  v_candidate date;
begin
  if p_type = 'end_of_month' then
    return (date_trunc('month', p_from) + interval '1 month - 1 day')::date;
  end if;
  v_candidate := make_date(extract(year from p_from)::int, extract(month from p_from)::int, p_day::int);
  if v_candidate >= p_from then
    return v_candidate;
  end if;
  return (v_candidate + interval '1 month')::date;
end;
$$;

-- Inicio "natural" de un periodo dado su fin
create or replace function private.period_start_for_end(p_type text, p_end date)
returns date
language sql immutable set search_path = ''
as $$
  select case
    when p_type = 'end_of_month' then date_trunc('month', p_end)::date
    else (p_end - interval '1 month')::date + 1
  end;
$$;

-- Periodo abierto actual del grupo.
--   · Con cierres previos: empieza el día siguiente al último cierre.
--   · Sin cierres: periodo natural que contiene la fecha de creación del grupo.
--   · Si al cambiar el día de cierre el periodo quedara de menos de 7 días,
--     se fusiona con el siguiente.
create or replace function private.current_period(p_group_id uuid)
returns table (period_start date, period_end date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
  v_last  date;
begin
  select * into v_group from public.groups g where g.id = p_group_id;
  if not found then
    return;
  end if;

  select max(s.period_end) into v_last
  from public.settlements s
  where s.group_id = p_group_id and s.status = 'closed';

  if v_last is not null then
    period_start := v_last + 1;
    period_end   := private.next_closing_date(v_group.closing_type, v_group.closing_day, period_start);
    if period_end - period_start < 6 then
      period_end := private.next_closing_date(v_group.closing_type, v_group.closing_day, period_end + 1);
    end if;
  else
    period_end   := private.next_closing_date(
                      v_group.closing_type, v_group.closing_day,
                      (v_group.created_at at time zone v_group.timezone)::date);
    period_start := private.period_start_for_end(v_group.closing_type, period_end);
  end if;

  return next;
end;
$$;


-- =============================================================================
-- 05  TRIGGERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at genérico
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at before update on public.groups
  for each row execute function private.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Alta automática de perfil al registrarse + sincronización de email
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Perfiles para usuarios que ya existieran antes de ejecutar el script
insert into public.profiles (id, email, display_name, avatar_url)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Al crear un grupo, su creador entra como propietario
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_group()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists groups_add_owner on public.groups;
create trigger groups_add_owner after insert on public.groups
  for each row execute function private.handle_new_group();

-- ---------------------------------------------------------------------------
-- Un grupo nunca puede quedarse sin propietario activo
-- ---------------------------------------------------------------------------
create or replace function private.group_members_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.group_id <> old.group_id or new.user_id <> old.user_id then
    raise exception 'IMMUTABLE_FIELD: no se puede cambiar el grupo ni el usuario de una membresía';
  end if;

  if old.role = 'owner' and old.left_at is null
     and (new.role <> 'owner' or new.left_at is not null) then
    if not exists (
      select 1 from public.group_members gm
      where gm.group_id = old.group_id
        and gm.user_id <> old.user_id
        and gm.role = 'owner'
        and gm.left_at is null
    ) then
      raise exception 'LAST_OWNER: el grupo debe conservar al menos un propietario';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists group_members_guard on public.group_members;
create trigger group_members_guard before update on public.group_members
  for each row execute function private.group_members_guard();

-- ---------------------------------------------------------------------------
-- Categorías: máximo dos niveles y jerarquía coherente
-- ---------------------------------------------------------------------------
create or replace function private.categories_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.categories%rowtype;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'CATEGORY_INVALID_PARENT: una categoría no puede ser su propio padre';
    end if;
    select * into v_parent from public.categories c where c.id = new.parent_id;
    if v_parent.parent_id is not null then
      raise exception 'CATEGORY_INVALID_PARENT: solo se permiten dos niveles de categorías';
    end if;
    if not v_parent.is_system
       and (v_parent.group_id is distinct from new.group_id
            or (new.group_id is null and v_parent.owner_id is distinct from new.owner_id)) then
      raise exception 'CATEGORY_INVALID_PARENT: la categoría padre pertenece a otro ámbito';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_guard on public.categories;
create trigger categories_guard before insert or update on public.categories
  for each row execute function private.categories_guard();

-- ---------------------------------------------------------------------------
-- Gastos: normalización, validación de negocio y bloqueo de periodos cerrados
-- ---------------------------------------------------------------------------
create or replace function private.expenses_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_group       public.groups%rowtype;
  v_cat         public.categories%rowtype;
  v_last_closed date;
begin
  -- Las funciones de cierre/reapertura activan este indicador para poder
  -- asignar o quitar settlement_id sin pasar por las validaciones de usuario.
  if coalesce(current_setting('app.bypass_period_lock', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.created_by    := coalesce(v_uid, new.created_by);
    new.paid_by       := coalesce(new.paid_by, new.created_by);
    new.created_at    := now();
    new.settlement_id := null;
    new.deleted_at    := null;
    new.deleted_by    := null;
  else
    if old.settlement_id is not null then
      raise exception 'PERIOD_CLOSED: el gasto pertenece a un periodo cerrado; reabre el periodo para modificarlo';
    end if;
    if new.settlement_id is distinct from old.settlement_id then
      raise exception 'FORBIDDEN_FIELD: settlement_id solo lo asigna el cierre de periodo';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;

    -- Soft delete / restauración
    if new.deleted_at is not null and old.deleted_at is null then
      new.deleted_at := now();
      new.deleted_by := v_uid;
    elsif new.deleted_at is not null then
      new.deleted_at := old.deleted_at;
      new.deleted_by := old.deleted_by;
    else
      new.deleted_by := null;
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := v_uid;

  -- Reglas según el tipo de gasto
  if new.scope = 'personal' then
    if new.paid_by <> new.created_by then
      raise exception 'PAYER_INVALID: un gasto personal solo puede pagarlo quien lo registra';
    end if;
    -- Moneda por defecto: la del perfil del usuario
    if new.currency is null then
      select p.currency into new.currency from public.profiles p where p.id = new.created_by;
    end if;
  else
    select * into v_group from public.groups g where g.id = new.group_id;
    if not found then
      raise exception 'GROUP_NOT_FOUND: el grupo no existe';
    end if;
    if tg_op = 'INSERT' and v_group.archived_at is not null then
      raise exception 'GROUP_ARCHIVED: el grupo está archivado';
    end if;

    if tg_op = 'INSERT'
       or new.paid_by <> old.paid_by
       or new.group_id is distinct from old.group_id then
      if not exists (
        select 1 from public.group_members gm
        where gm.group_id = new.group_id and gm.user_id = new.paid_by and gm.left_at is null
      ) then
        raise exception 'PAYER_NOT_MEMBER: quien paga debe ser miembro activo del grupo';
      end if;
    end if;

    -- Un grupo opera en una sola moneda
    new.currency := v_group.currency;

    -- No se puede escribir dentro de un periodo ya cerrado
    select max(s.period_end) into v_last_closed
    from public.settlements s
    where s.group_id = new.group_id and s.status = 'closed';

    if v_last_closed is not null and new.expense_date <= v_last_closed and new.deleted_at is null then
      raise exception 'PERIOD_CLOSED: la fecha % cae en un periodo cerrado (último cierre: %)',
        new.expense_date, v_last_closed;
    end if;
  end if;

  -- La categoría debe ser visible para todos los que verán el gasto
  select * into v_cat from public.categories c where c.id = new.category_id;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND: la categoría no existe';
  end if;
  if not (
    v_cat.is_system
    or (new.scope = 'personal' and v_cat.group_id is null and v_cat.owner_id = new.created_by)
    or (new.scope = 'shared' and v_cat.group_id = new.group_id)
  ) then
    raise exception 'CATEGORY_NOT_ALLOWED: la categoría no está disponible para este gasto';
  end if;

  return new;
end;
$$;

drop trigger if exists expenses_before_write on public.expenses;
create trigger expenses_before_write before insert or update on public.expenses
  for each row execute function private.expenses_before_write();

-- ---------------------------------------------------------------------------
-- Auditoría genérica: guarda el antes y el después de cada cambio
-- ---------------------------------------------------------------------------
create or replace function private.audit_trigger()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old     jsonb;
  v_new     jsonb;
  v_row     jsonb;
  v_changed text[];
  v_action  text := tg_op;
  v_group   uuid;
  v_owner   uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_new) n
    where n.value is distinct from (v_old -> n.key)
      and n.key not in ('updated_at', 'updated_by');

    if v_changed is null then
      return null;  -- nada relevante cambió
    end if;

    if 'deleted_at' = any (v_changed) then
      v_action := case when (v_new ->> 'deleted_at') is not null then 'SOFT_DELETE' else 'RESTORE' end;
    end if;
  end if;

  if tg_table_name = 'groups' then
    v_group := (v_row ->> 'id')::uuid;
  else
    v_group := (v_row ->> 'group_id')::uuid;
  end if;

  if tg_table_name = 'profiles' then
    v_owner := (v_row ->> 'id')::uuid;
  else
    v_owner := coalesce(
      v_row ->> 'created_by', v_row ->> 'owner_id', v_row ->> 'user_id', v_row ->> 'from_user'
    )::uuid;
  end if;

  insert into public.audit_log
    (table_name, record_id, action, old_data, new_data, changed_fields, actor_id, owner_id, group_id)
  values (
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'user_id')::uuid,
    v_action, v_old, v_new, v_changed,
    auth.uid(), v_owner, v_group
  );

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'groups', 'group_members', 'group_invitations', 'categories',
    'expenses', 'expense_attachments', 'settlements', 'settlement_transfers'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit_trigger()', t || '_audit', t);
  end loop;
end $$;


-- =============================================================================
-- 06  LIQUIDACIÓN DE GASTOS COMPARTIDOS
--
--   total   = suma de gastos compartidos del periodo
--   cuota   = total / número de participantes
--   balance = lo que pagó cada uno - cuota
--             > 0  le deben    < 0  debe
--
--   Participantes = miembros activos + cualquiera que haya pagado en el periodo.
--   Entran en el cálculo todos los gastos compartidos sin liquidar con
--   fecha <= fin de periodo.
-- =============================================================================

create or replace function private.compute_group_balances(p_group_id uuid, p_period_end date)
returns table (user_id uuid, paid numeric, share numeric, balance numeric)
language sql stable security definer set search_path = ''
as $$
  with open_expenses as (
    select e.paid_by, e.amount
    from public.expenses e
    where e.group_id = p_group_id
      and e.scope = 'shared'
      and e.deleted_at is null
      and e.settlement_id is null
      and e.expense_date <= p_period_end
  ),
  participants as (
    select gm.user_id as uid
    from public.group_members gm
    where gm.group_id = p_group_id and gm.left_at is null
    union
    select oe.paid_by from open_expenses oe
  ),
  payments as (
    select p.uid, coalesce(sum(oe.amount), 0)::numeric(14,2) as paid_amount
    from participants p
    left join open_expenses oe on oe.paid_by = p.uid
    group by p.uid
  ),
  totals as (
    select sum(pm.paid_amount) as total, count(*) as n from payments pm
  ),
  base as (
    select
      pm.uid,
      pm.paid_amount,
      round(t.total / t.n, 2) as base_share,
      -- céntimos que sobran al redondear la cuota
      t.total - round(t.total / t.n, 2) * t.n as residual,
      row_number() over (order by pm.paid_amount desc, pm.uid) as rn
    from payments pm
    cross join totals t
  )
  -- El residuo de redondeo se asigna a quien más pagó, para que los balances sumen 0
  select
    b.uid,
    b.paid_amount::numeric,
    (case when b.rn = 1 then b.base_share + b.residual else b.base_share end)::numeric,
    (b.paid_amount - case when b.rn = 1 then b.base_share + b.residual else b.base_share end)::numeric
  from base b;
$$;

-- Transferencias mínimas: empareja al que más debe con al que más le deben
create or replace function private.compute_transfers(p_group_id uuid, p_period_end date)
returns table (from_user uuid, to_user uuid, amount numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_deb_ids uuid[];
  v_deb_amt numeric[];
  v_cre_ids uuid[];
  v_cre_amt numeric[];
  i   int := 1;
  j   int := 1;
  v_x numeric;
begin
  select array_agg(b.user_id order by b.balance, b.user_id),
         array_agg(-b.balance order by b.balance, b.user_id)
    into v_deb_ids, v_deb_amt
  from private.compute_group_balances(p_group_id, p_period_end) b
  where b.balance < 0;

  select array_agg(b.user_id order by b.balance desc, b.user_id),
         array_agg(b.balance order by b.balance desc, b.user_id)
    into v_cre_ids, v_cre_amt
  from private.compute_group_balances(p_group_id, p_period_end) b
  where b.balance > 0;

  while i <= coalesce(array_length(v_deb_ids, 1), 0)
    and j <= coalesce(array_length(v_cre_ids, 1), 0) loop
    v_x := least(v_deb_amt[i], v_cre_amt[j]);
    if v_x > 0 then
      from_user := v_deb_ids[i];
      to_user   := v_cre_ids[j];
      amount    := v_x;
      return next;
    end if;
    v_deb_amt[i] := v_deb_amt[i] - v_x;
    v_cre_amt[j] := v_cre_amt[j] - v_x;
    if v_deb_amt[i] <= 0 then i := i + 1; end if;
    if v_cre_amt[j] <= 0 then j := j + 1; end if;
  end loop;
end;
$$;

-- Cierra todos los periodos vencidos de un grupo. Devuelve cuántos cerró.
create or replace function private.close_due_periods_internal(p_group_id uuid, p_actor uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_group      public.groups%rowtype;
  v_today      date;
  v_start      date;
  v_end        date;
  v_settlement uuid;
  v_total      numeric(14,2);
  v_members    integer;
  v_count      integer := 0;
begin
  select * into v_group from public.groups g where g.id = p_group_id for update;
  if not found or v_group.archived_at is not null or v_group.close_hold then
    return 0;
  end if;

  v_today := (now() at time zone v_group.timezone)::date;

  while v_count < 120 loop
    select cp.period_start, cp.period_end into v_start, v_end
    from private.current_period(p_group_id) cp;

    exit when v_end is null or v_end >= v_today;

    insert into public.settlements
      (group_id, period_start, period_end, status, closing_type, closing_day, currency, closed_by)
    values
      (p_group_id, v_start, v_end, 'closed', v_group.closing_type, v_group.closing_day, v_group.currency, p_actor)
    returning id into v_settlement;

    insert into public.settlement_balances (settlement_id, user_id, paid, share, balance)
    select v_settlement, b.user_id, b.paid, b.share, b.balance
    from private.compute_group_balances(p_group_id, v_end) b;

    insert into public.settlement_transfers (settlement_id, from_user, to_user, amount)
    select v_settlement, t.from_user, t.to_user, t.amount
    from private.compute_transfers(p_group_id, v_end) t;

    select coalesce(sum(sb.paid), 0), count(*) into v_total, v_members
    from public.settlement_balances sb
    where sb.settlement_id = v_settlement;

    update public.settlements s
       set total_amount = v_total, member_count = v_members
     where s.id = v_settlement;

    -- Bloquea los gastos incluidos en el cierre
    perform set_config('app.bypass_period_lock', 'on', true);
    update public.expenses e
       set settlement_id = v_settlement
     where e.group_id = p_group_id
       and e.scope = 'shared'
       and e.deleted_at is null
       and e.settlement_id is null
       and e.expense_date <= v_end;
    perform set_config('app.bypass_period_lock', 'off', true);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Recorre todos los grupos (lo invoca pg_cron). Un grupo con error no detiene al resto.
create or replace function private.close_all_due_periods()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_group_id uuid;
  v_total    integer := 0;
begin
  for v_group_id in
    select g.id from public.groups g where g.archived_at is null and not g.close_hold
  loop
    begin
      v_total := v_total + private.close_due_periods_internal(v_group_id, null);
    exception when others then
      perform set_config('app.bypass_period_lock', 'off', true);
      raise warning 'close_all_due_periods: grupo % falló: %', v_group_id, sqlerrm;
    end;
  end loop;
  return v_total;
end;
$$;


-- =============================================================================
-- 07  RPC PÚBLICAS  (supabase.rpc('nombre', {...}))
-- =============================================================================

-- Balance en vivo del periodo abierto de un grupo
create or replace function public.get_group_balance(p_group_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_group public.groups%rowtype;
  v_start date;
  v_end   date;
begin
  if not private.is_group_member(p_group_id) then
    raise exception 'FORBIDDEN: no perteneces a este grupo';
  end if;

  select * into v_group from public.groups g where g.id = p_group_id;
  select cp.period_start, cp.period_end into v_start, v_end
  from private.current_period(p_group_id) cp;

  return jsonb_build_object(
    'group_id',     p_group_id,
    'currency',     v_group.currency,
    'period_start', v_start,
    'period_end',   v_end,
    'close_hold',   v_group.close_hold,
    'total', (
      select coalesce(sum(b.paid), 0)
      from private.compute_group_balances(p_group_id, v_end) b
    ),
    'balances', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id',      b.user_id,
               'display_name', p.display_name,
               'avatar_url',   p.avatar_url,
               'paid',         b.paid,
               'share',        b.share,
               'balance',      b.balance
             ) order by b.balance desc, p.display_name), '[]'::jsonb)
      from private.compute_group_balances(p_group_id, v_end) b
      join public.profiles p on p.id = b.user_id
    ),
    'transfers', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'from_user', t.from_user,
               'to_user',   t.to_user,
               'amount',    t.amount
             )), '[]'::jsonb)
      from private.compute_transfers(p_group_id, v_end) t
    )
  );
end;
$$;

-- Cierra los periodos vencidos del grupo (el front lo llama al abrir el grupo;
-- así el cierre funciona aunque pg_cron no esté activo).
-- p_release_hold = true: un propietario vuelve a cerrar tras una reapertura.
create or replace function public.close_due_periods(p_group_id uuid, p_release_hold boolean default false)
returns integer
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_group_member(p_group_id) then
    raise exception 'FORBIDDEN: no perteneces a este grupo';
  end if;

  if p_release_hold then
    if not private.is_group_owner(p_group_id) then
      raise exception 'FORBIDDEN: solo un propietario puede volver a cerrar el periodo';
    end if;
    update public.groups g set close_hold = false where g.id = p_group_id;
  end if;

  return private.close_due_periods_internal(p_group_id, auth.uid());
end;
$$;

-- Reabre el último periodo cerrado para poder corregir gastos.
-- El cierre anterior queda en el historial con estado 'reopened'.
create or replace function public.reopen_last_period(p_group_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_settlement uuid;
begin
  if not private.is_group_owner(p_group_id) then
    raise exception 'FORBIDDEN: solo un propietario puede reabrir un periodo';
  end if;

  select s.id into v_settlement
  from public.settlements s
  where s.group_id = p_group_id and s.status = 'closed'
  order by s.period_end desc
  limit 1
  for update;

  if v_settlement is null then
    raise exception 'NOTHING_TO_REOPEN: el grupo no tiene periodos cerrados';
  end if;

  update public.settlements s
     set status = 'reopened', reopened_at = now(), reopened_by = auth.uid()
   where s.id = v_settlement;

  perform set_config('app.bypass_period_lock', 'on', true);
  update public.expenses e set settlement_id = null where e.settlement_id = v_settlement;
  perform set_config('app.bypass_period_lock', 'off', true);

  update public.groups g set close_hold = true where g.id = p_group_id;

  return v_settlement;
end;
$$;

-- Marca una transferencia de liquidación como pagada / pendiente
create or replace function public.mark_transfer_paid(p_transfer_id uuid, p_paid boolean default true)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_tr    public.settlement_transfers%rowtype;
  v_group uuid;
begin
  select * into v_tr from public.settlement_transfers t where t.id = p_transfer_id for update;
  if not found then
    raise exception 'NOT_FOUND: la transferencia no existe';
  end if;

  select s.group_id into v_group from public.settlements s where s.id = v_tr.settlement_id;

  if not (v_uid in (v_tr.from_user, v_tr.to_user) or private.is_group_owner(v_group)) then
    raise exception 'FORBIDDEN: solo los implicados o un propietario pueden marcar el pago';
  end if;

  update public.settlement_transfers t
     set paid_at   = case when p_paid then now() else null end,
         marked_by = v_uid
   where t.id = p_transfer_id;
end;
$$;

-- Vista previa de una invitación (para mostrar el grupo antes de aceptar)
create or replace function public.get_invitation_preview(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'group_id',     g.id,
    'group_name',   g.name,
    'group_icon',   g.icon,
    'group_color',  g.color,
    'invited_by',   p.display_name,
    'member_count', (select count(*) from public.group_members gm
                     where gm.group_id = g.id and gm.left_at is null),
    'is_valid',     (i.revoked_at is null and i.expires_at > now()
                     and i.used_count < i.max_uses and g.archived_at is null)
  )
  from public.group_invitations i
  join public.groups g on g.id = i.group_id
  join public.profiles p on p.id = i.created_by
  where i.token = p_token;
$$;

-- Acepta una invitación y une al usuario actual al grupo
create or replace function public.accept_group_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_inv  public.group_invitations%rowtype;
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED: inicia sesión para aceptar la invitación';
  end if;

  select * into v_inv from public.group_invitations i where i.token = p_token for update;

  if not found
     or v_inv.revoked_at is not null
     or v_inv.expires_at <= now()
     or v_inv.used_count >= v_inv.max_uses
     or exists (select 1 from public.groups g where g.id = v_inv.group_id and g.archived_at is not null) then
    raise exception 'INVITATION_INVALID: la invitación no existe, venció o ya fue usada';
  end if;

  insert into public.group_members as gm (group_id, user_id, role, invited_by)
  values (v_inv.group_id, v_uid, 'member', v_inv.created_by)
  on conflict (group_id, user_id) do update
    set left_at = null, joined_at = now(), role = 'member', invited_by = excluded.invited_by
    where gm.left_at is not null;

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update public.group_invitations i set used_count = i.used_count + 1 where i.id = v_inv.id;
  end if;

  return v_inv.group_id;
end;
$$;

-- El usuario actual abandona un grupo
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.group_members gm
     set left_at = now()
   where gm.group_id = p_group_id and gm.user_id = v_uid and gm.left_at is null;

  if not found then
    raise exception 'NOT_MEMBER: no perteneces a este grupo';
  end if;

  update public.profiles p
     set default_scope = 'personal', default_group_id = null
   where p.id = v_uid and p.default_group_id = p_group_id;
end;
$$;


-- =============================================================================
-- 08  VISTA Y FUNCIONES DE DASHBOARD
-- =============================================================================

-- Gastos enriquecidos. security_invoker => se aplica la RLS del usuario que consulta.
--   split_count  : entre cuántos se reparte (1 si es personal)
--   share_amount : la parte que le corresponde a cada participante
drop view if exists public.v_expenses;
create view public.v_expenses
with (security_invoker = true)
as
select
  e.id,
  e.scope,
  e.group_id,
  g.name                        as group_name,
  e.paid_by,
  pr.display_name               as paid_by_name,
  pr.avatar_url                 as paid_by_avatar_url,
  e.category_id,
  c.name                        as category_name,
  c.icon                        as category_icon,
  c.color                       as category_color,
  coalesce(pc.id, c.id)         as root_category_id,
  coalesce(pc.name, c.name)     as root_category_name,
  coalesce(pc.icon, c.icon)     as root_category_icon,
  coalesce(pc.color, c.color)   as root_category_color,
  e.amount,
  e.currency,
  sc.split_count,
  round(e.amount / sc.split_count, 2) as share_amount,
  e.description,
  e.merchant,
  e.expense_date,
  e.payment_method,
  e.notes,
  e.source,
  e.settlement_id,
  (e.settlement_id is not null) as is_locked,
  e.created_by,
  e.created_at,
  e.updated_by,
  e.updated_at,
  e.deleted_at,
  e.deleted_by
from public.expenses e
left join public.categories c   on c.id = e.category_id
left join public.categories pc  on pc.id = c.parent_id
left join public.groups g       on g.id = e.group_id
left join public.settlements s  on s.id = e.settlement_id
left join public.profiles pr    on pr.id = e.paid_by
cross join lateral (
  select case
    when e.scope = 'personal' then 1
    else greatest(
      coalesce(
        nullif(s.member_count, 0),
        (select count(*) from public.group_members gm
         where gm.group_id = e.group_id and gm.left_at is null)
      ), 1)
  end::integer as split_count
) sc;

-- Gasto por categoría.
--   p_scope       : 'all' | 'personal' | 'shared'
--   p_group_id    : filtra un grupo concreto (opcional)
--   p_full_amount : false = mi parte de los compartidos · true = importe total
--   p_level       : 'parent' (categoría) | 'child' (subcategoría)
create or replace function public.dashboard_by_category(
  p_from        date,
  p_to          date,
  p_scope       text    default 'all',
  p_group_id    uuid    default null,
  p_full_amount boolean default false,
  p_level       text    default 'parent'
)
returns table (
  category_id uuid, name text, icon text, color text,
  currency text, total numeric, tx_count bigint
)
language sql stable set search_path = ''
as $$
  select
    case when p_level = 'parent' then v.root_category_id    else v.category_id    end,
    case when p_level = 'parent' then v.root_category_name  else v.category_name  end,
    case when p_level = 'parent' then v.root_category_icon  else v.category_icon  end,
    case when p_level = 'parent' then v.root_category_color else v.category_color end,
    v.currency,
    sum(case when p_full_amount then v.amount else v.share_amount end)::numeric,
    count(*)
  from public.v_expenses v
  where v.deleted_at is null
    and v.expense_date between p_from and p_to
    and (p_scope = 'all' or v.scope = p_scope)
    and (p_group_id is null or v.group_id = p_group_id)
  group by 1, 2, 3, 4, 5
  order by 6 desc;
$$;

-- Evolución mensual del gasto
create or replace function public.dashboard_by_month(
  p_from        date,
  p_to          date,
  p_scope       text    default 'all',
  p_group_id    uuid    default null,
  p_full_amount boolean default false
)
returns table (month date, currency text, total numeric, tx_count bigint)
language sql stable set search_path = ''
as $$
  select
    date_trunc('month', v.expense_date)::date,
    v.currency,
    sum(case when p_full_amount then v.amount else v.share_amount end)::numeric,
    count(*)
  from public.v_expenses v
  where v.deleted_at is null
    and v.expense_date between p_from and p_to
    and (p_scope = 'all' or v.scope = p_scope)
    and (p_group_id is null or v.group_id = p_group_id)
  group by 1, 2
  order by 1, 2;
$$;


-- =============================================================================
-- 09  ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles             enable row level security;
alter table public.groups               enable row level security;
alter table public.group_members        enable row level security;
alter table public.group_invitations    enable row level security;
alter table public.categories           enable row level security;
alter table public.expenses             enable row level security;
alter table public.expense_attachments  enable row level security;
alter table public.settlements          enable row level security;
alter table public.settlement_balances  enable row level security;
alter table public.settlement_transfers enable row level security;
alter table public.audit_log            enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_group_with(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- groups ---------------------------------------------------------------------
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using (private.is_group_member(id) or created_by = (select auth.uid()));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (private.is_group_owner(id))
  with check (private.is_group_owner(id));

-- group_members (altas solo por invitación / trigger; bajas con leave_group) --
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated
  using (private.is_group_member(group_id));

drop policy if exists group_members_update on public.group_members;
create policy group_members_update on public.group_members for update to authenticated
  using (private.is_group_owner(group_id))
  with check (private.is_group_owner(group_id));

-- group_invitations ----------------------------------------------------------
drop policy if exists group_invitations_select on public.group_invitations;
create policy group_invitations_select on public.group_invitations for select to authenticated
  using (private.is_group_owner(group_id));

drop policy if exists group_invitations_insert on public.group_invitations;
create policy group_invitations_insert on public.group_invitations for insert to authenticated
  with check (private.is_group_owner(group_id) and created_by = (select auth.uid()));

drop policy if exists group_invitations_update on public.group_invitations;
create policy group_invitations_update on public.group_invitations for update to authenticated
  using (private.is_group_owner(group_id))
  with check (private.is_group_owner(group_id));

-- categories -----------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (
    is_system
    or (group_id is null and owner_id = (select auth.uid()))
    or (group_id is not null and private.is_group_member(group_id))
  );

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories for insert to authenticated
  with check (
    not is_system
    and owner_id = (select auth.uid())
    and (group_id is null or private.is_group_member(group_id))
  );

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated
  using (
    not is_system
    and ((group_id is null and owner_id = (select auth.uid()))
         or (group_id is not null and private.is_group_member(group_id)))
  )
  with check (
    not is_system
    and ((group_id is null and owner_id = (select auth.uid()))
         or (group_id is not null and private.is_group_member(group_id)))
  );

-- expenses (sin DELETE: el borrado es lógico mediante deleted_at) ---------------
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (
    (scope = 'personal' and paid_by = (select auth.uid()))
    or (scope = 'shared' and private.is_group_member(group_id))
  );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (scope = 'personal' and paid_by = (select auth.uid()))
      or (scope = 'shared' and private.is_group_member(group_id))
    )
  );

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
  using (
    (scope = 'personal' and paid_by = (select auth.uid()))
    or (scope = 'shared' and private.is_group_member(group_id))
  )
  with check (
    (scope = 'personal' and paid_by = (select auth.uid()))
    or (scope = 'shared' and private.is_group_member(group_id))
  );

-- expense_attachments (heredan la visibilidad del gasto) ---------------------
drop policy if exists expense_attachments_select on public.expense_attachments;
create policy expense_attachments_select on public.expense_attachments for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id));

drop policy if exists expense_attachments_insert on public.expense_attachments;
create policy expense_attachments_insert on public.expense_attachments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.expenses e where e.id = expense_id)
  );

drop policy if exists expense_attachments_delete on public.expense_attachments;
create policy expense_attachments_delete on public.expense_attachments for delete to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and e.settlement_id is null));

-- settlements y derivados (solo lectura; se escriben mediante funciones) ------
drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements for select to authenticated
  using (private.is_group_member(group_id));

drop policy if exists settlement_balances_select on public.settlement_balances;
create policy settlement_balances_select on public.settlement_balances for select to authenticated
  using (exists (select 1 from public.settlements s where s.id = settlement_id));

drop policy if exists settlement_transfers_select on public.settlement_transfers;
create policy settlement_transfers_select on public.settlement_transfers for select to authenticated
  using (exists (select 1 from public.settlements s where s.id = settlement_id));

-- audit_log (solo lectura, nunca se modifica) --------------------------------
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (
    actor_id = (select auth.uid())
    or owner_id = (select auth.uid())
    or (group_id is not null and private.is_group_member(group_id))
  );


-- =============================================================================
-- 10  PRIVILEGIOS
--     Explícitos: no dependen de los privilegios por defecto del proyecto.
--     El rol anon (visitante sin sesión) no tiene acceso a nada.
-- =============================================================================
revoke all on
  public.profiles, public.groups, public.group_members, public.group_invitations,
  public.categories, public.expenses, public.expense_attachments,
  public.settlements, public.settlement_balances, public.settlement_transfers,
  public.audit_log, public.v_expenses
from anon, authenticated;

grant select on
  public.profiles, public.groups, public.group_members, public.group_invitations,
  public.categories, public.expenses, public.expense_attachments,
  public.settlements, public.settlement_balances, public.settlement_transfers,
  public.audit_log, public.v_expenses
to authenticated;

-- Solo las columnas que el usuario puede tocar
grant update (display_name, avatar_url, currency, locale, timezone,
              default_scope, default_group_id, default_payment_method, onboarded_at)
  on public.profiles to authenticated;

grant insert (name, description, icon, color, currency, timezone, closing_type, closing_day, created_by)
  on public.groups to authenticated;
grant update (name, description, icon, color, timezone, closing_type, closing_day, archived_at)
  on public.groups to authenticated;

grant update (role, left_at) on public.group_members to authenticated;

grant insert (group_id, max_uses, expires_at, created_by) on public.group_invitations to authenticated;
grant update (revoked_at) on public.group_invitations to authenticated;

grant insert (owner_id, group_id, parent_id, name, icon, color, sort_order)
  on public.categories to authenticated;
grant update (parent_id, name, icon, color, sort_order, archived_at)
  on public.categories to authenticated;

grant insert (id, scope, group_id, paid_by, category_id, amount, currency, description, merchant,
              expense_date, payment_method, notes, source, source_metadata, created_by)
  on public.expenses to authenticated;
grant update (scope, group_id, paid_by, category_id, amount, currency, description, merchant,
              expense_date, payment_method, notes, deleted_at)
  on public.expenses to authenticated;

grant insert (expense_id, storage_path, file_name, mime_type, size_bytes, kind, created_by)
  on public.expense_attachments to authenticated;
grant delete on public.expense_attachments to authenticated;

grant all on
  public.profiles, public.groups, public.group_members, public.group_invitations,
  public.categories, public.expenses, public.expense_attachments,
  public.settlements, public.settlement_balances, public.settlement_transfers,
  public.audit_log, public.v_expenses
to service_role;

-- Funciones internas: solo las que usa la RLS son ejecutables por usuarios
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_group_member(uuid)   to authenticated;
grant execute on function private.is_group_owner(uuid)    to authenticated;
grant execute on function private.shares_group_with(uuid) to authenticated;
grant execute on all functions in schema private to service_role;

-- RPC públicas: solo usuarios con sesión
revoke execute on function public.get_group_balance(uuid)                                    from public, anon;
revoke execute on function public.close_due_periods(uuid, boolean)                           from public, anon;
revoke execute on function public.reopen_last_period(uuid)                                   from public, anon;
revoke execute on function public.mark_transfer_paid(uuid, boolean)                          from public, anon;
revoke execute on function public.get_invitation_preview(text)                               from public, anon;
revoke execute on function public.accept_group_invitation(text)                              from public, anon;
revoke execute on function public.leave_group(uuid)                                          from public, anon;
revoke execute on function public.dashboard_by_category(date, date, text, uuid, boolean, text) from public, anon;
revoke execute on function public.dashboard_by_month(date, date, text, uuid, boolean)        from public, anon;

grant execute on function public.get_group_balance(uuid)                                    to authenticated, service_role;
grant execute on function public.close_due_periods(uuid, boolean)                           to authenticated, service_role;
grant execute on function public.reopen_last_period(uuid)                                   to authenticated, service_role;
grant execute on function public.mark_transfer_paid(uuid, boolean)                          to authenticated, service_role;
grant execute on function public.get_invitation_preview(text)                               to authenticated, service_role;
grant execute on function public.accept_group_invitation(text)                              to authenticated, service_role;
grant execute on function public.leave_group(uuid)                                          to authenticated, service_role;
grant execute on function public.dashboard_by_category(date, date, text, uuid, boolean, text) to authenticated, service_role;
grant execute on function public.dashboard_by_month(date, date, text, uuid, boolean)        to authenticated, service_role;


-- =============================================================================
-- 11  STORAGE: bucket privado de recibos
--     Ruta de cada archivo:  {user_id}/{expense_id}/{nombre}
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Lee quien lo subió o quien puede ver el gasto al que está adjunto
drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.expense_attachments a
        where a.storage_path = storage.objects.name
      )
    )
  );

drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- =============================================================================
-- 12  DATOS SEMILLA: categorías del sistema
--     17 categorías y 77 subcategorías. icon = nombre de icono de lucide.
-- =============================================================================
with seed (slug, parent_slug, name, icon, color, sort_order) as (
  values
  -- Categorías principales
  ('vivienda',          null, 'Vivienda',                 'home',            '#6366F1', 10),
  ('servicios',         null, 'Servicios básicos',        'plug',            '#0EA5E9', 20),
  ('alimentacion',      null, 'Alimentación',             'utensils',        '#F97316', 30),
  ('transporte',        null, 'Transporte',               'car',             '#14B8A6', 40),
  ('salud',             null, 'Salud',                    'heart-pulse',     '#EF4444', 50),
  ('cuidado-personal',  null, 'Cuidado personal',         'sparkles',        '#EC4899', 60),
  ('ropa',              null, 'Ropa y calzado',           'shirt',           '#A855F7', 70),
  ('educacion',         null, 'Educación',                'graduation-cap',  '#3B82F6', 80),
  ('ocio',              null, 'Ocio y entretenimiento',   'clapperboard',    '#F59E0B', 90),
  ('viajes',            null, 'Viajes',                   'plane',           '#06B6D4', 100),
  ('familia',           null, 'Familia e hijos',          'baby',            '#84CC16', 110),
  ('mascotas',          null, 'Mascotas',                 'paw-print',       '#A16207', 120),
  ('tecnologia',        null, 'Tecnología',               'laptop',          '#64748B', 130),
  ('finanzas',          null, 'Finanzas y obligaciones',  'landmark',        '#059669', 140),
  ('regalos',           null, 'Regalos y donaciones',     'gift',            '#E11D48', 150),
  ('trabajo',           null, 'Trabajo y negocio',        'briefcase',       '#475569', 160),
  ('otros',             null, 'Otros',                    'ellipsis',        '#9CA3AF', 170),

  -- Vivienda
  ('vivienda-alquiler',       'vivienda', 'Alquiler o hipoteca',             'key-round',    '#6366F1', 1),
  ('vivienda-condominio',     'vivienda', 'Condominio y gastos comunes',     'building-2',   '#6366F1', 2),
  ('vivienda-mantenimiento',  'vivienda', 'Mantenimiento y reparaciones',    'wrench',       '#6366F1', 3),
  ('vivienda-muebles',        'vivienda', 'Muebles y electrodomésticos',     'sofa',         '#6366F1', 4),
  ('vivienda-limpieza',       'vivienda', 'Artículos del hogar y limpieza',  'spray-can',    '#6366F1', 5),
  ('vivienda-seguros',        'vivienda', 'Seguros e impuestos de vivienda', 'shield',       '#6366F1', 6),

  -- Servicios básicos
  ('servicios-luz',       'servicios', 'Electricidad',          'zap',         '#0EA5E9', 1),
  ('servicios-agua',      'servicios', 'Agua',                  'droplets',    '#0EA5E9', 2),
  ('servicios-gas',       'servicios', 'Gas',                   'flame',       '#0EA5E9', 3),
  ('servicios-internet',  'servicios', 'Internet y TV',         'wifi',        '#0EA5E9', 4),
  ('servicios-telefonia', 'servicios', 'Telefonía móvil',       'smartphone',  '#0EA5E9', 5),

  -- Alimentación
  ('alimentacion-supermercado', 'alimentacion', 'Supermercado y mercado',  'shopping-cart',    '#F97316', 1),
  ('alimentacion-restaurantes', 'alimentacion', 'Restaurantes',            'utensils-crossed', '#F97316', 2),
  ('alimentacion-delivery',     'alimentacion', 'Delivery',                'bike',             '#F97316', 3),
  ('alimentacion-cafe',         'alimentacion', 'Cafés y snacks',          'coffee',           '#F97316', 4),
  ('alimentacion-panaderia',    'alimentacion', 'Panadería y tiendas',     'store',            '#F97316', 5),
  ('alimentacion-bebidas',      'alimentacion', 'Bebidas y licores',       'wine',             '#F97316', 6),

  -- Transporte
  ('transporte-combustible',    'transporte', 'Combustible',                      'fuel',            '#14B8A6', 1),
  ('transporte-publico',        'transporte', 'Transporte público',               'bus',             '#14B8A6', 2),
  ('transporte-taxi',           'transporte', 'Taxi y apps de movilidad',         'car-taxi-front',  '#14B8A6', 3),
  ('transporte-estacionamiento','transporte', 'Estacionamiento y peajes',         'square-parking',  '#14B8A6', 4),
  ('transporte-mantenimiento',  'transporte', 'Mantenimiento del vehículo',       'wrench',          '#14B8A6', 5),
  ('transporte-seguro',         'transporte', 'Seguro e impuestos del vehículo',  'shield-check',    '#14B8A6', 6),

  -- Salud
  ('salud-consultas',  'salud', 'Consultas médicas',       'stethoscope',  '#EF4444', 1),
  ('salud-farmacia',   'salud', 'Farmacia',                'pill',         '#EF4444', 2),
  ('salud-seguro',     'salud', 'Seguro de salud',         'shield-plus',  '#EF4444', 3),
  ('salud-dental',     'salud', 'Dental',                  'smile',        '#EF4444', 4),
  ('salud-optica',     'salud', 'Óptica',                  'glasses',      '#EF4444', 5),
  ('salud-mental',     'salud', 'Terapia y salud mental',  'brain',        '#EF4444', 6),
  ('salud-examenes',   'salud', 'Exámenes y laboratorio',  'microscope',   '#EF4444', 7),

  -- Cuidado personal
  ('cuidado-peluqueria', 'cuidado-personal', 'Peluquería y barbería',    'scissors',  '#EC4899', 1),
  ('cuidado-higiene',    'cuidado-personal', 'Higiene y cosmética',      'droplet',   '#EC4899', 2),
  ('cuidado-gimnasio',   'cuidado-personal', 'Gimnasio y deporte',       'dumbbell',  '#EC4899', 3),
  ('cuidado-spa',        'cuidado-personal', 'Spa y bienestar',          'flower-2',  '#EC4899', 4),

  -- Ropa y calzado
  ('ropa-ropa',        'ropa', 'Ropa',                      'shirt',            '#A855F7', 1),
  ('ropa-calzado',     'ropa', 'Calzado',                   'footprints',       '#A855F7', 2),
  ('ropa-accesorios',  'ropa', 'Accesorios y joyería',      'watch',            '#A855F7', 3),
  ('ropa-lavanderia',  'ropa', 'Lavandería y tintorería',   'washing-machine',  '#A855F7', 4),

  -- Educación
  ('educacion-matricula', 'educacion', 'Matrícula y pensiones',     'school',     '#3B82F6', 1),
  ('educacion-cursos',    'educacion', 'Cursos y capacitaciones',   'presentation','#3B82F6', 2),
  ('educacion-libros',    'educacion', 'Libros',                    'book-open',  '#3B82F6', 3),
  ('educacion-utiles',    'educacion', 'Útiles y materiales',       'pencil',     '#3B82F6', 4),

  -- Ocio y entretenimiento
  ('ocio-eventos',       'ocio', 'Cine, conciertos y eventos',   'ticket',     '#F59E0B', 1),
  ('ocio-streaming',     'ocio', 'Streaming y suscripciones',    'tv',         '#F59E0B', 2),
  ('ocio-hobbies',       'ocio', 'Hobbies',                      'palette',    '#F59E0B', 3),
  ('ocio-videojuegos',   'ocio', 'Videojuegos',                  'gamepad-2',  '#F59E0B', 4),
  ('ocio-bares',         'ocio', 'Bares y vida nocturna',        'beer',       '#F59E0B', 5),
  ('ocio-deportes',      'ocio', 'Deportes y actividades',       'trophy',     '#F59E0B', 6),

  -- Viajes
  ('viajes-pasajes',      'viajes', 'Pasajes',                 'plane',     '#06B6D4', 1),
  ('viajes-alojamiento',  'viajes', 'Alojamiento',             'bed',       '#06B6D4', 2),
  ('viajes-actividades',  'viajes', 'Tours y actividades',     'map',       '#06B6D4', 3),
  ('viajes-comidas',      'viajes', 'Comidas de viaje',        'utensils',  '#06B6D4', 4),
  ('viajes-seguro',       'viajes', 'Seguro y trámites',       'file-text', '#06B6D4', 5),

  -- Familia e hijos
  ('familia-colegio',   'familia', 'Colegio y guardería',       'school',      '#84CC16', 1),
  ('familia-cuidado',   'familia', 'Niñera y cuidado',          'heart',       '#84CC16', 2),
  ('familia-juguetes',  'familia', 'Juguetes y ropa infantil',  'blocks',      '#84CC16', 3),
  ('familia-mesadas',   'familia', 'Mesadas y apoyo familiar',  'hand-coins',  '#84CC16', 4),

  -- Mascotas
  ('mascotas-alimento',     'mascotas', 'Alimento',             'bone',      '#A16207', 1),
  ('mascotas-veterinario',  'mascotas', 'Veterinario',          'syringe',   '#A16207', 2),
  ('mascotas-accesorios',   'mascotas', 'Accesorios y aseo',    'paw-print', '#A16207', 3),

  -- Tecnología
  ('tecnologia-dispositivos', 'tecnologia', 'Dispositivos',          'monitor-smartphone', '#64748B', 1),
  ('tecnologia-software',     'tecnologia', 'Software y apps',       'app-window',         '#64748B', 2),
  ('tecnologia-accesorios',   'tecnologia', 'Accesorios',            'cable',              '#64748B', 3),
  ('tecnologia-nube',         'tecnologia', 'Nube y servicios web',  'cloud',              '#64748B', 4),

  -- Finanzas y obligaciones
  ('finanzas-comisiones', 'finanzas', 'Comisiones bancarias',       'banknote',     '#059669', 1),
  ('finanzas-intereses',  'finanzas', 'Intereses',                  'percent',      '#059669', 2),
  ('finanzas-prestamos',  'finanzas', 'Pago de préstamos',          'credit-card',  '#059669', 3),
  ('finanzas-seguros',    'finanzas', 'Seguros (vida y otros)',     'umbrella',     '#059669', 4),
  ('finanzas-impuestos',  'finanzas', 'Impuestos y trámites',       'receipt',      '#059669', 5),

  -- Regalos y donaciones
  ('regalos-regalos',        'regalos', 'Regalos',                  'gift',             '#E11D48', 1),
  ('regalos-donaciones',     'regalos', 'Donaciones',               'heart-handshake',  '#E11D48', 2),
  ('regalos-celebraciones',  'regalos', 'Celebraciones y fiestas',  'party-popper',     '#E11D48', 3),

  -- Trabajo y negocio
  ('trabajo-materiales',  'trabajo', 'Materiales y herramientas',  'package',    '#475569', 1),
  ('trabajo-servicios',   'trabajo', 'Servicios profesionales',    'users',      '#475569', 2),
  ('trabajo-oficina',     'trabajo', 'Oficina y coworking',        'building',   '#475569', 3),

  -- Otros
  ('otros-imprevistos',    'otros', 'Imprevistos',     'triangle-alert', '#9CA3AF', 1),
  ('otros-sin-categoria',  'otros', 'Sin categoría',   'circle-help',    '#9CA3AF', 2)
),
parents as (
  insert into public.categories (slug, name, icon, color, sort_order, is_system)
  select s.slug, s.name, s.icon, s.color, s.sort_order, true
  from seed s
  where s.parent_slug is null
    and not exists (select 1 from public.categories c where c.is_system and c.slug = s.slug)
  returning id, slug
),
all_parents as (
  select id, slug from parents
  union all
  select c.id, c.slug from public.categories c where c.is_system and c.parent_id is null
)
insert into public.categories (slug, parent_id, name, icon, color, sort_order, is_system)
select s.slug, ap.id, s.name, s.icon, s.color, s.sort_order, true
from seed s
join all_parents ap on ap.slug = s.parent_slug
where not exists (select 1 from public.categories c where c.is_system and c.slug = s.slug);


-- =============================================================================
-- 13  OPCIONALES (si fallan, solo emiten un aviso)
-- =============================================================================

-- Cierre automático: cada hora cierra los periodos vencidos de todos los grupos.
-- Sin pg_cron la app sigue funcionando: el front llama a close_due_periods().
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'registro-close-due-periods',
    '10 * * * *',
    $job$select private.close_all_due_periods();$job$
  );
exception when others then
  raise notice 'pg_cron no disponible (%). El cierre se hará bajo demanda desde la app.', sqlerrm;
end $$;

-- Realtime: los gastos compartidos se actualizan en vivo entre miembros
do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception when others then
  raise notice 'Realtime no configurado para expenses (%).', sqlerrm;
end $$;

-- =============================================================================
-- 14  CATEGORÍAS DEL SISTEMA OCULTAS POR USUARIO
--     Preferencia visual: cada usuario oculta subcategorías del sistema en su
--     formulario de gasto. No afecta a gastos, balances ni panel.
--     Mismo contenido que migrations/002_categorias_ocultas.sql.
-- =============================================================================
create table if not exists public.hidden_categories (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, category_id)
);
comment on table public.hidden_categories is
  'Subcategorías del sistema que cada usuario oculta en su formulario de gasto. Preferencia visual: no afecta a los datos.';

create index if not exists hidden_categories_category_idx on public.hidden_categories (category_id);

-- Solo subcategorías del sistema, y nunca "Sin categoría"
create or replace function private.hidden_categories_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_cat public.categories%rowtype;
begin
  select * into v_cat from public.categories c where c.id = new.category_id;
  if not found or not v_cat.is_system or v_cat.parent_id is null then
    raise exception 'CATEGORY_NOT_HIDEABLE: solo se pueden ocultar subcategorías del sistema';
  end if;
  if v_cat.slug = 'otros-sin-categoria' then
    raise exception 'CATEGORY_NOT_HIDEABLE: "Sin categoría" siempre está disponible';
  end if;
  return new;
end;
$$;

drop trigger if exists hidden_categories_guard on public.hidden_categories;
create trigger hidden_categories_guard before insert or update on public.hidden_categories
  for each row execute function private.hidden_categories_guard();

-- RLS: cada usuario, lo suyo
alter table public.hidden_categories enable row level security;

drop policy if exists hidden_categories_select on public.hidden_categories;
create policy hidden_categories_select on public.hidden_categories for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists hidden_categories_insert on public.hidden_categories;
create policy hidden_categories_insert on public.hidden_categories for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists hidden_categories_delete on public.hidden_categories;
create policy hidden_categories_delete on public.hidden_categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- Privilegios
revoke all on public.hidden_categories from anon, authenticated;
grant select, delete on public.hidden_categories to authenticated;
grant insert (user_id, category_id) on public.hidden_categories to authenticated;
grant all on public.hidden_categories to service_role;
revoke execute on function private.hidden_categories_guard() from public, anon, authenticated;
grant execute on function private.hidden_categories_guard() to service_role;

-- =============================================================================
--  FIN
-- =============================================================================
