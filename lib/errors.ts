/**
 * Traduce los errores de la base de datos a mensajes para el usuario.
 * data_supabase.sql lanza los errores de negocio como "CODIGO: detalle".
 */
const MESSAGES: Record<string, string> = {
  PERIOD_CLOSED: "Este gasto pertenece a un periodo ya cerrado. Un propietario del grupo puede reabrirlo para corregirlo.",
  FORBIDDEN_FIELD: "Ese dato no se puede modificar.",
  PAYER_INVALID: "Un gasto personal solo puede pagarlo quien lo registra.",
  PAYER_NOT_MEMBER: "Quien pagó debe ser miembro activo del grupo.",
  GROUP_NOT_FOUND: "El grupo no existe o ya no tienes acceso.",
  GROUP_ARCHIVED: "El grupo está archivado: ya no admite gastos nuevos.",
  CATEGORY_NOT_FOUND: "La categoría no existe.",
  CATEGORY_NOT_ALLOWED: "Esa categoría no está disponible para este gasto.",
  CATEGORY_INVALID_PARENT: "La categoría principal elegida no es válida.",
  LAST_OWNER: "El grupo debe conservar al menos un propietario. Nombra a otro antes de salir.",
  IMMUTABLE_FIELD: "Ese dato no se puede modificar.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
  NOTHING_TO_REOPEN: "El grupo no tiene periodos cerrados.",
  NOT_FOUND: "No se encontró el elemento.",
  NOT_MEMBER: "No perteneces a este grupo.",
  INVITATION_INVALID: "La invitación no existe, venció o ya se usó.",
  UNAUTHENTICATED: "Tu sesión terminó. Vuelve a iniciar sesión.",
  VALIDATION: "Revisa los datos del formulario.",
};

type PgError = { message?: string; code?: string; details?: string | null } | null | undefined;

export function translateError(error: PgError): { code: string; message: string } {
  const raw = error?.message ?? "";
  const match = raw.match(/^([A-Z_]{4,}):/);
  if (match && MESSAGES[match[1]]) {
    return { code: match[1], message: MESSAGES[match[1]] };
  }

  switch (error?.code) {
    case "42501": // privilegios o RLS
      return { code: "FORBIDDEN", message: MESSAGES.FORBIDDEN };
    case "23514": // CHECK
    case "22P02": // tipo inválido
      return { code: "VALIDATION", message: MESSAGES.VALIDATION };
    case "23505":
      return { code: "DUPLICATE", message: "Ya existe un registro igual." };
    case "23503":
      return { code: "IN_USE", message: "No se puede: hay otros datos que dependen de este." };
    case "PGRST116":
      return { code: "NOT_FOUND", message: MESSAGES.NOT_FOUND };
  }

  if (/fetch failed|network/i.test(raw)) {
    return { code: "NETWORK", message: "No hay conexión con el servidor. Inténtalo de nuevo." };
  }

  console.error("[db]", error);
  return { code: "UNKNOWN", message: "Algo salió mal. Inténtalo de nuevo." };
}

export function messageForCode(code: string): string {
  return MESSAGES[code] ?? "Algo salió mal. Inténtalo de nuevo.";
}
