"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAttachment } from "@/lib/actions/expenses";
import { uploadReceipt } from "@/lib/receipts";

export type AttachmentItem = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  url: string | null;
  can_delete: boolean;
};

function size(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function Attachments({
  items,
  expenseId,
  userId,
  editable,
}: {
  items: AttachmentItem[];
  expenseId: string;
  userId: string;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function upload(file: File | undefined) {
    if (!file) return;
    startTransition(async () => {
      const err = await uploadReceipt(userId, expenseId, file);
      if (err) toast.error(err);
      else toast.success("Recibo adjuntado");
    });
  }

  return (
    <div className="space-y-3">
      {items.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-xl border bg-muted/40">
              <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="block">
                {a.url && a.mime_type.startsWith("image/") && a.mime_type !== "image/heic" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage
                  <img src={a.url} alt={`Recibo ${a.file_name}`} className="aspect-[3/4] w-full object-cover" />
                ) : (
                  <span className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <FileText className="size-8" />
                    <span className="text-xs">{a.mime_type === "application/pdf" ? "PDF" : "Archivo"}</span>
                  </span>
                )}
                <span className="block truncate border-t bg-background px-2 py-1.5 text-xs">
                  {a.file_name} <span className="text-muted-foreground">· {size(a.size_bytes)}</span>
                </span>
              </a>
              {editable && a.can_delete ? (
                <Button
                  size="icon-sm"
                  variant="secondary"
                  className="absolute top-2 right-2 opacity-90"
                  aria-label={`Quitar ${a.file_name}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await deleteAttachment(a.id);
                      if (res.ok) toast("Recibo eliminado");
                      else toast.error(res.message);
                    })
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="size-4" /> Sin recibos adjuntos.
        </p>
      )}
      {editable ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            <Plus /> {pending ? "Subiendo…" : "Adjuntar recibo"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
