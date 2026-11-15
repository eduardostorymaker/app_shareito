import { Suspense } from "react";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpenseRow } from "@/components/expenses/expense-list";
import { RestoreButton } from "@/components/expenses/restore-button";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Papelera" };

export default function TrashPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={0} rows={6} />}>
      <Trash />
    </Suspense>
  );
}

async function Trash() {
  const profile = await getProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_expenses")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(200);
  const items = data ?? [];

  return (
    <div>
      <PageHeader
        back={{ href: "/ajustes", label: "Ajustes" }}
        title="Papelera"
        description="Los gastos eliminados no cuentan en totales ni balances. Puedes restaurarlos cuando quieras."
      />
      {items.length ? (
        <ul className="divide-y rounded-xl border">
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-2 pr-3">
              <div className="min-w-0 flex-1">
                <ExpenseRow e={e} userId={profile.id} locale={profile.locale} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <RestoreButton id={e.id} />
                <span className="hidden text-[11px] text-muted-foreground sm:block">{formatDateTime(e.deleted_at!)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Trash2} title="La papelera está vacía" description="Cuando elimines un gasto aparecerá aquí." />
      )}
    </div>
  );
}
