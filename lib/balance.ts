import { formatMoney, joinNames } from "@/lib/format";
import type { GroupBalance } from "@/lib/types";

export type Situation = { tone: "positive" | "negative" | "neutral"; text: string; amount: number };

/** Frase directa sobre la situación del usuario en un grupo: "Le debes S/ 45,00 a Ana". */
export function describeSituation(b: GroupBalance, userId: string, locale?: string): Situation {
  const money = (n: number) => formatMoney(n, b.currency, locale);
  const name = (id: string) => b.balances.find((x) => x.user_id === id)?.display_name ?? "alguien";
  const mine = b.balances.find((x) => x.user_id === userId)?.balance ?? 0;

  if (mine < -0.004) {
    const outgoing = b.transfers.filter((t) => t.from_user === userId);
    if (outgoing.length === 1) {
      return { tone: "negative", amount: mine, text: `Le debes ${money(outgoing[0]!.amount)} a ${name(outgoing[0]!.to_user)}` };
    }
    return {
      tone: "negative",
      amount: mine,
      text: `Debes ${money(-mine)}: ${joinNames(outgoing.map((t) => `${money(t.amount)} a ${name(t.to_user)}`))}`,
    };
  }

  if (mine > 0.004) {
    const incoming = b.transfers.filter((t) => t.to_user === userId);
    if (incoming.length === 1) {
      return { tone: "positive", amount: mine, text: `${name(incoming[0]!.from_user)} te debe ${money(incoming[0]!.amount)}` };
    }
    return { tone: "positive", amount: mine, text: `Te deben ${money(mine)}` };
  }

  return { tone: "neutral", amount: 0, text: b.total > 0 ? "Están a mano" : "Aún no hay gastos en este periodo" };
}
