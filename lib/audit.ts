import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { describeClosing } from "@/lib/periods";
import type { Json } from "@/types/database";
import type { AuditEntry } from "@/lib/types";

export type AuditContext = {
  names: Map<string, string>;
  categories: Map<string, string>;
  groups: Map<string, string>;
  locale: string;
  meId: string;
};

type Row = Record<string, Json | undefined>;

const EXPENSE_FIELDS: Record<string, string> = {
  amount: "Importe",
  category_id: "Categoría",
  expense_date: "Fecha",
  description: "Descripción",
  merchant: "Comercio",
  notes: "Notas",
  payment_method: "Método de pago",
  scope: "Tipo",
  group_id: "Grupo",
  paid_by: "Pagó",
  currency: "Moneda",
};

/** Pretérito en segunda persona para las acciones propias: "editó" → "editaste". */
const SECOND_PERSON: Record<string, string> = {
  registró: "registraste", envió: "enviaste", restauró: "restauraste", eliminó: "eliminaste",
  reabrió: "reabriste", editó: "editaste", creó: "creaste", quitó: "quitaste", nombró: "nombraste",
  cambió: "cambiaste", archivó: "archivaste", reactivó: "reactivaste", cerró: "cerraste",
  marcó: "marcaste", desactivó: "desactivaste", salió: "saliste",
};

/** Sujeto + verbo conjugado: "Editaste" (yo), "Ana editó" (otra persona). */
function actor(entry: Pick<AuditEntry, "actor_id">, ctx: AuditContext) {
  return (verb: string) => {
    if (entry.actor_id && entry.actor_id === ctx.meId) return capitalize(SECOND_PERSON[verb] ?? verb);
    const name = entry.actor_id ? (ctx.names.get(entry.actor_id) ?? "Alguien") : "El sistema";
    return `${name} ${verb}`;
  };
}

function str(v: Json | undefined): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

function formatExpenseValue(field: string, value: Json | undefined, row: Row, ctx: AuditContext): string {
  const s = str(value);
  if (s === null) return "—";
  switch (field) {
    case "amount":
      return formatMoney(Number(value), String(row.currency ?? "USD"), ctx.locale);
    case "category_id":
      return ctx.categories.get(s) ?? "Categoría eliminada";
    case "group_id":
      return ctx.groups.get(s) ?? "Grupo";
    case "paid_by":
      return s === ctx.meId ? "Tú" : (ctx.names.get(s) ?? "Otro miembro");
    case "expense_date":
      return formatDate(s);
    case "payment_method":
      return PAYMENT_METHOD_LABEL[s] ?? s;
    case "scope":
      return s === "shared" ? "Compartido" : "Personal";
    default:
      return s;
  }
}

export type ExpenseChange = { label: string; from: string; to: string };

/** Qué cambió en una fila de auditoría de un gasto. */
export function describeExpenseEntry(entry: AuditEntry, ctx: AuditContext): { title: string; changes: ExpenseChange[] } {
  const a = actor(entry, ctx);
  const oldRow = (entry.old_data ?? {}) as Row;
  const newRow = (entry.new_data ?? {}) as Row;

  switch (entry.action) {
    case "INSERT":
      return {
        title: `${a("registró")} el gasto`,
        changes: [
          { label: "Importe", from: "", to: formatExpenseValue("amount", newRow.amount, newRow, ctx) },
          { label: "Categoría", from: "", to: formatExpenseValue("category_id", newRow.category_id, newRow, ctx) },
        ],
      };
    case "SOFT_DELETE":
      return { title: `${a("envió")} el gasto a la papelera`, changes: [] };
    case "RESTORE":
      return { title: `${a("restauró")} el gasto`, changes: [] };
    case "DELETE":
      return { title: `${a("eliminó")} el gasto definitivamente`, changes: [] };
  }

  const fields = entry.changed_fields ?? [];
  if (fields.length === 1 && fields[0] === "settlement_id") {
    return newRow.settlement_id
      ? { title: "Incluido en el cierre del periodo", changes: [] }
      : { title: `${a("reabrió")} el periodo: el gasto vuelve a ser editable`, changes: [] };
  }

  const changes = fields
    .filter((f) => EXPENSE_FIELDS[f] && !(f === "currency" && fields.includes("scope")))
    .map((f) => ({
      label: EXPENSE_FIELDS[f]!,
      from: formatExpenseValue(f, oldRow[f], oldRow, ctx),
      to: formatExpenseValue(f, newRow[f], newRow, ctx),
    }));
  return { title: `${a("editó")} el gasto`, changes };
}

/** Una línea legible de la actividad de un grupo. */
export function describeGroupEntry(entry: AuditEntry, ctx: AuditContext): string | null {
  const a = actor(entry, ctx);
  const o = (entry.old_data ?? {}) as Row;
  const n = (entry.new_data ?? {}) as Row;
  const row = Object.keys(n).length ? n : o;
  const fields = entry.changed_fields ?? [];
  const person = (id: Json | undefined) => {
    const s = str(id);
    if (!s) return "alguien";
    return s === ctx.meId ? "ti" : (ctx.names.get(s) ?? "un miembro");
  };
  const amount = () => formatExpenseValue("amount", row.amount, row, ctx);
  const what = () => str(row.description) ?? ctx.categories.get(String(row.category_id)) ?? "un gasto";

  switch (entry.table_name) {
    case "expenses":
      if (entry.action === "INSERT") return `${a("registró")} ${amount()} en ${what()}`;
      if (entry.action === "SOFT_DELETE") return `${a("eliminó")} ${amount()} en ${what()}`;
      if (entry.action === "RESTORE") return `${a("restauró")} ${amount()} en ${what()}`;
      if (fields.length === 1 && fields[0] === "settlement_id") return null;
      return `${a("editó")} ${what()} (${fields.map((f) => EXPENSE_FIELDS[f]?.toLowerCase()).filter(Boolean).join(", ")})`;

    case "group_members": {
      const target = person(row.user_id);
      if (entry.action === "INSERT") return row.role === "owner" ? `${a("creó")} el grupo` : `${target === "ti" ? "Te uniste" : `${capitalize(target)} se unió`} al grupo`;
      if (fields.includes("left_at")) {
        if (n.left_at === null) return `${capitalize(target)} volvió al grupo`;
        return entry.actor_id === row.user_id ? `${a("salió")} del grupo` : (target === "ti" ? `${a("te quitó")} del grupo` : `${a("quitó")} a ${target} del grupo`);
      }
      if (fields.includes("role")) return target === "ti"
          ? n.role === "owner" ? `${a("te nombró")} propietario` : `${a("te quitó")} el rol de propietario`
          : n.role === "owner" ? `${a("nombró")} propietario a ${target}` : `${a("quitó")} el rol de propietario a ${target}`;
      if (fields.includes("joined_at")) return `${capitalize(target)} volvió al grupo`;
      return null;
    }

    case "groups":
      if (entry.action === "INSERT") return null;
      if (fields.includes("closing_type") || fields.includes("closing_day"))
        return `${a("cambió")} el cierre: ${describeClosing(String(n.closing_type), n.closing_day as number | null).toLowerCase()}`;
      if (fields.includes("archived_at")) return n.archived_at ? `${a("archivó")} el grupo` : `${a("reactivó")} el grupo`;
      if (fields.includes("close_hold")) return null;
      if (fields.includes("name")) return `${a("cambió")} el nombre a “${str(n.name)}”`;
      return `${a("editó")} el grupo`;

    case "settlements":
      if (entry.action === "INSERT")
        return `${entry.actor_id ? a("cerró") : "Se cerró"} el periodo ${formatPeriod(String(row.period_start), String(row.period_end))}`;
      if (fields.includes("status") && n.status === "reopened")
        return `${a("reabrió")} el periodo ${formatPeriod(String(row.period_start), String(row.period_end))}`;
      return null;

    case "settlement_transfers":
      if (fields.includes("paid_at"))
        return n.paid_at
          ? `${a("marcó")} como pagada la transferencia de ${person(row.from_user)} a ${person(row.to_user)}`
          : `${a("marcó")} como pendiente la transferencia de ${person(row.from_user)} a ${person(row.to_user)}`;
      return null;

    case "group_invitations":
      if (entry.action === "INSERT") return `${a("creó")} un enlace de invitación`;
      if (fields.includes("revoked_at")) return `${a("desactivó")} un enlace de invitación`;
      return null;

    case "categories":
      if (entry.action === "INSERT") return `${a("creó")} la categoría “${str(row.name)}”`;
      if (fields.includes("archived_at")) return `${a(n.archived_at ? "archivó" : "reactivó")} la categoría “${str(row.name)}”`;
      return `${a("editó")} la categoría “${str(row.name)}”`;
  }
  return null;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ids de personas, categorías y grupos mencionados en las filas, para resolver sus nombres. */
export function collectAuditRefs(entries: AuditEntry[]) {
  const people = new Set<string>();
  const categories = new Set<string>();
  const groups = new Set<string>();
  for (const e of entries) {
    if (e.actor_id) people.add(e.actor_id);
    for (const r of [e.old_data, e.new_data] as (Row | null)[]) {
      if (!r) continue;
      for (const k of ["paid_by", "user_id", "from_user", "to_user", "created_by"]) if (typeof r[k] === "string") people.add(r[k] as string);
      if (typeof r.category_id === "string") categories.add(r.category_id);
      if (typeof r.group_id === "string") groups.add(r.group_id);
    }
  }
  return { people: [...people], categories: [...categories], groups: [...groups] };
}
