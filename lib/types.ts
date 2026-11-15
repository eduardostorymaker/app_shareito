import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];
type Views = Database["public"]["Views"];

export type Profile = Tables["profiles"]["Row"];
export type Group = Tables["groups"]["Row"];
export type GroupMember = Tables["group_members"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Expense = Tables["expenses"]["Row"];
export type ExpenseView = Views["v_expenses"]["Row"];
export type Settlement = Tables["settlements"]["Row"];
export type SettlementTransfer = Tables["settlement_transfers"]["Row"];
export type AuditEntry = Tables["audit_log"]["Row"];
export type Attachment = Tables["expense_attachments"]["Row"];

export type Scope = "personal" | "shared";
export type ClosingType = "end_of_month" | "day_of_month";

/** Miembro de grupo con los datos públicos de su perfil. */
export type MemberInfo = {
  user_id: string;
  role: "owner" | "member";
  display_name: string;
  avatar_url: string | null;
};

/** Grupo con sus miembros activos, tal como lo consume la interfaz. */
export type GroupWithMembers = Group & { members: MemberInfo[] };

/** Respuesta de la RPC get_group_balance. */
export type GroupBalance = {
  group_id: string;
  currency: string;
  period_start: string;
  period_end: string;
  close_hold: boolean;
  total: number;
  balances: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    paid: number;
    share: number;
    balance: number;
  }[];
  transfers: { from_user: string; to_user: string; amount: number }[];
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };
