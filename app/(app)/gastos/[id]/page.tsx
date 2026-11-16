import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/skeletons";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Money } from "@/components/shared/money";
import { HistoryTimeline } from "@/components/shared/history-timeline";
import { ExpenseActions } from "@/components/expenses/expense-actions";
import { Attachments } from "@/components/expenses/attachments";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfileNames } from "@/lib/queries";
import { collectAuditRefs, describeExpenseEntry } from "@/lib/audit";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const metadata = { title: "Detalle del gasto" };

export default function ExpenseDetailPage({ params }: PageProps<"/gastos/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton cards={1} rows={4} />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/gastos/[id]">["params"] }) {
  const [{ id }, profile] = await Promise.all([params, getProfile()]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const [{ data: e }, { data: attachments }, { data: history }] = await Promise.all([
    supabase.from("v_expenses").select("*").eq("id", id).maybeSingle(),
    supabase.from("expense_attachments").select("*").eq("expense_id", id).order("created_at"),
    supabase
      .from("audit_log")
      .select("*")
      .eq("table_name", "expenses")
      .eq("record_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (!e) notFound();

  const refs = collectAuditRefs(history ?? []);
  const [names, cats, grps, signed] = await Promise.all([
    getProfileNames([...refs.people, e.created_by, e.updated_by ?? "", e.deleted_by ?? ""]),
    refs.categories.length ? supabase.from("categories").select("id, name").in("id", refs.categories) : Promise.resolve({ data: [] }),
    refs.groups.length ? supabase.from("groups").select("id, name").in("id", refs.groups) : Promise.resolve({ data: [] }),
    attachments?.length
      ? supabase.storage.from("receipts").createSignedUrls(attachments.map((a) => a.storage_path), 3600)
      : Promise.resolve({ data: [] }),
  ]);

  const ctx = {
    names,
    categories: new Map((cats.data ?? []).map((c) => [c.id, c.name])),
    groups: new Map((grps.data ?? []).map((g) => [g.id, g.name])),
    locale: profile.locale,
    meId: profile.id,
  };
  const timeline = (history ?? []).map((h) => ({ id: h.id, at: h.created_at, ...describeExpenseEntry(h, ctx) }));
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  const deleted = Boolean(e.deleted_at);
  const locked = Boolean(e.is_locked);
  const person = (pid: string | null) => (!pid ? "—" : pid === profile.id ? "Tú" : (names.get(pid) ?? "Otro miembro"));
  const title = e.description || e.merchant || e.category_name || "Gasto";

  const rows: [string, React.ReactNode][] = [
    ["Fecha", <span key="d" className="capitalize">{formatDate(e.expense_date, "EEEE d 'de' MMMM 'de' yyyy")}</span>],
    ["Categoría", e.root_category_name && e.root_category_name !== e.category_name ? `${e.root_category_name} › ${e.category_name}` : e.category_name],
    [
      "Tipo",
      e.scope === "shared" ? (
        <Link key="g" href={`/grupos/${e.group_id}`} className="font-medium text-primary">
          Compartido · {e.group_name}
        </Link>
      ) : (
        "Personal"
      ),
    ],
    ...(e.scope === "shared"
      ? ([
          ["Pagó", person(e.paid_by)],
          [
            "Reparto",
            `${formatMoney(e.share_amount ?? e.amount, e.currency, profile.locale)} por persona · entre ${e.split_count ?? 1}`,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ["Método de pago", PAYMENT_METHOD_LABEL[e.payment_method] ?? e.payment_method],
    ...(e.merchant ? ([["Comercio", e.merchant]] as [string, React.ReactNode][]) : []),
    ...(e.description && e.merchant ? ([["Descripción", e.description]] as [string, React.ReactNode][]) : []),
    ...(e.notes ? ([["Notas", <span key="n" className="whitespace-pre-wrap">{e.notes}</span>]] as [string, React.ReactNode][]) : []),
    ["Registrado", `${person(e.created_by)} · ${formatDateTime(e.created_at)}`],
    ...(e.updated_by && e.updated_at !== e.created_at
      ? ([["Última edición", `${person(e.updated_by)} · ${formatDateTime(e.updated_at)}`]] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div>
      <PageHeader back={{ href: "/gastos", label: "Gastos" }} title={title} />

      {deleted ? (
        <div className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <Trash2 className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            Este gasto está en la papelera desde el {formatDateTime(e.deleted_at!)}
            {e.deleted_by ? ` (lo eliminó ${e.deleted_by === profile.id ? "tú" : person(e.deleted_by)})` : ""}. No cuenta en
            totales ni balances.
          </p>
        </div>
      ) : locked ? (
        <div className="mb-4 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            Este gasto pertenece a un periodo cerrado y ya no se puede modificar.{" "}
            <Link href={`/grupos/${e.group_id}/cierres/${e.settlement_id}`} className="font-medium text-primary">
              Ver el cierre
            </Link>
          </p>
        </div>
      ) : null}

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <CategoryIcon icon={e.category_icon} color={e.category_color} size="lg" />
            <div>
              <Money amount={e.amount} currency={e.currency} locale={profile.locale} tabular={false} className="block font-heading text-3xl font-semibold tracking-tight" />
              <p className="text-sm text-muted-foreground">{e.category_name}</p>
            </div>
          </div>
          <ExpenseActions
            deleted={deleted}
            draft={{
              id: e.id,
              scope: e.scope as "personal" | "shared",
              group_id: e.group_id,
              paid_by: e.paid_by,
              category_id: e.category_id,
              amount: e.amount,
              expense_date: e.expense_date,
              payment_method: e.payment_method,
              description: e.description,
              merchant: e.merchant,
              notes: e.notes,
              is_locked: locked,
            }}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="historial">Historial ({timeline.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="detalle" className="mt-4 space-y-6">
          <dl className="divide-y rounded-xl border">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recibos</CardTitle>
            </CardHeader>
            <CardContent>
              <Attachments
                expenseId={e.id}
                userId={profile.id}
                editable={!deleted && !locked}
                items={(attachments ?? []).map((a) => ({
                  id: a.id,
                  file_name: a.file_name,
                  mime_type: a.mime_type,
                  size_bytes: a.size_bytes,
                  url: urlByPath.get(a.storage_path) ?? null,
                  can_delete: true,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="historial" className="mt-4">
          <HistoryTimeline items={timeline} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
