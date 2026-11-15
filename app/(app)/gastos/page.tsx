import { Suspense } from "react";
import Link from "next/link";
import { ReceiptText, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/skeletons";
import { ExpenseList } from "@/components/expenses/expense-list";
import { ExpenseFilters } from "@/components/expenses/expense-filters";
import { NewExpenseButton } from "@/components/expenses/new-expense-button";
import { getProfile } from "@/lib/auth";
import { getCategories, getMyGroups } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, todayISO } from "@/lib/format";
import { resolveRange } from "@/lib/ranges";

export const metadata = { title: "Gastos" };

const PAGE = 100;

export default function ExpensesPage({ searchParams }: PageProps<"/gastos">) {
  return (
    <Suspense fallback={<PageSkeleton cards={0} rows={10} />}>
      <Expenses searchParams={searchParams} />
    </Suspense>
  );
}

function param(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

async function Expenses({ searchParams }: { searchParams: PageProps<"/gastos">["searchParams"] }) {
  const [profile, sp] = await Promise.all([getProfile(), searchParams]);
  const [groups, categories] = await Promise.all([getMyGroups({ includeArchived: true }), getCategories()]);
  const supabase = await createClient();

  const q = param(sp.q)?.replace(/[,()*%\\]/g, " ").trim();
  const tipo = param(sp.tipo);
  const grupo = param(sp.grupo);
  const categoria = param(sp.categoria);
  const limit = Math.min(Math.max(Number(param(sp.limite)) || PAGE, PAGE), 1000);
  const range = resolveRange(param(sp.rango), new Date(`${todayISO(profile.timezone)}T12:00:00`), {
    from: param(sp.desde),
    to: param(sp.hasta),
  });

  let query = supabase
    .from("v_expenses")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tipo === "personal") query = query.eq("scope", "personal");
  if (tipo === "compartido") query = query.eq("scope", "shared");
  if (grupo && /^[0-9a-f-]{36}$/i.test(grupo)) query = query.eq("group_id", grupo);
  if (categoria && /^[0-9a-f-]{36}$/i.test(categoria)) query = query.or(`category_id.eq.${categoria},root_category_id.eq.${categoria}`);
  if (range) query = query.gte("expense_date", range.from).lte("expense_date", range.to);
  if (q) query = query.or(`description.ilike.*${q}*,merchant.ilike.*${q}*,category_name.ilike.*${q}*`);

  const { data, count, error } = await query;
  if (error) throw error;
  const expenses = data ?? [];

  // En bloques para no superar el tamaño máximo de URL de la API.
  const ids = expenses.map((e) => e.id);
  const chunks = Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, i * 150 + 150));
  const attachmentRows = await Promise.all(
    chunks.map((c) => supabase.from("expense_attachments").select("expense_id").in("expense_id", c)),
  );
  const withReceipt = new Set(attachmentRows.flatMap((r) => r.data ?? []).map((a) => a.expense_id));

  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);

  const filtered = Boolean(q || tipo || grupo || categoria || range);
  const roots = categories.filter((c) => !c.parent_id);
  const nextLimit = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
  nextLimit.set("limite", String(limit + PAGE));

  return (
    <div>
      <PageHeader
        title="Gastos"
        description={
          expenses.length ? (
            <>
              {count ?? expenses.length} {count === 1 ? "gasto" : "gastos"}
              {filtered ? " con estos filtros" : ""} ·{" "}
              <span className="tabular-nums">{[...totals.entries()].map(([c, t]) => formatMoney(t, c, profile.locale)).join(" · ")}</span>
              {count && count > expenses.length ? ` (primeros ${expenses.length})` : ""}
            </>
          ) : undefined
        }
        actions={<NewExpenseButton className="hidden lg:inline-flex" />}
      />

      <ExpenseFilters
        options={{
          groups: groups.map((g) => ({ id: g.id, name: g.name })),
          categories: roots.map((c) => ({ id: c.id, name: c.name })),
        }}
      />

      <div className="mt-6">
        {expenses.length ? (
          <>
            <ExpenseList
              expenses={expenses.map((e) => ({ ...e, has_attachment: withReceipt.has(e.id) }))}
              userId={profile.id}
              locale={profile.locale}
              className="-mx-2"
            />
            {count && count > expenses.length ? (
              <div className="mt-6 flex justify-center">
                <Button asChild variant="outline">
                  <Link href={`/gastos?${nextLimit}`} scroll={false}>
                    Cargar más
                  </Link>
                </Button>
              </div>
            ) : null}
          </>
        ) : filtered ? (
          <EmptyState icon={SearchX} title="No hay gastos con estos filtros" description="Prueba con otras fechas o quita algún filtro." />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Todavía no hay gastos"
            description="Cada gasto que registres aparecerá aquí, agrupado por día."
            action={<NewExpenseButton label="Registrar un gasto" />}
          />
        )}
      </div>
    </div>
  );
}
