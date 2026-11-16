-- =============================================================================
--  SHAREITO · Migración 002 · Categorías del sistema ocultas por usuario
-- =============================================================================
--  Para proyectos que ya ejecutaron data_supabase.sql.
--  SQL Editor -> pegar este archivo -> Run. Es idempotente: se puede repetir.
--
--  Cada usuario puede ocultar subcategorías del sistema en SU formulario de gasto.
--  Ocultar no cambia nada para los demás ni afecta a gastos, balances o panel.
--
--  Reglas (las aplica la base de datos):
--    · Solo subcategorías del sistema (las categorías principales se ocultan
--      ocultando todas sus subcategorías; las propias se archivan como siempre).
--    · "Otros › Sin categoría" no se puede ocultar: siempre queda una opción.
--    · Cada usuario solo ve y cambia sus propias filas.
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
