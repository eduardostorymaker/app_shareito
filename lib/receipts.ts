"use client";

import { createClient } from "@/lib/supabase/client";
import { addAttachment } from "@/lib/actions/expenses";
import { MAX_RECEIPT_BYTES, RECEIPT_MIME_TYPES } from "@/lib/constants";

export function validateReceipt(file: File): string | null {
  if (file.size > MAX_RECEIPT_BYTES) return "El archivo supera los 10 MB.";
  const type = mimeOf(file);
  if (!RECEIPT_MIME_TYPES.includes(type)) return "Solo se admiten imágenes (JPG, PNG, WEBP, HEIC) o PDF.";
  return null;
}

function mimeOf(file: File): string {
  if (file.type) return file.type;
  if (/\.hei[cf]$/i.test(file.name)) return "image/heic";
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  return "application/octet-stream";
}

/** Sube el recibo a Storage (receipts/{user}/{gasto}/{archivo}) y lo registra en la base. */
export async function uploadReceipt(userId: string, expenseId: string, file: File): Promise<string | null> {
  const invalid = validateReceipt(file);
  if (invalid) return invalid;

  const safeName = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || "recibo";
  const path = `${userId}/${expenseId}/${Date.now()}-${safeName}`;
  const contentType = mimeOf(file);

  const supabase = createClient();
  const { error } = await supabase.storage.from("receipts").upload(path, file, { contentType, upsert: false });
  if (error) return "No se pudo subir el recibo.";

  const res = await addAttachment({
    expense_id: expenseId,
    storage_path: path,
    file_name: file.name.slice(0, 200),
    mime_type: contentType,
    size_bytes: file.size,
  });
  if (!res.ok) {
    await supabase.storage.from("receipts").remove([path]);
    return res.message;
  }
  return null;
}
