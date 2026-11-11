"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_SIDE = 1600;
const MAX_BYTES = 1_400_000;

/**
 * Reduz a foto antes de enviar: no máximo 1600 px no lado maior, JPEG.
 * Reencodar no canvas também descarta o EXIF (GPS); o servidor limpa de novo.
 */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    for (const [side, quality] of [
      [MAX_SIDE, 0.8],
      [1280, 0.7],
      [1024, 0.6],
    ] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
    throw new Error("too big");
  } finally {
    bitmap.close();
  }
}

type Props = {
  groupId: string;
  expenseId: string;
  receipt: { createdAt: Date } | null;
  canManage: boolean;
};

export function ReceiptAttachment({ groupId, expenseId, receipt, canManage }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [open, setOpen] = useState(false);
  const url = `/api/grupos/${groupId}/despesas/${expenseId}/comprovante`;
  const src = receipt ? `${url}?v=${new Date(receipt.createdAt).getTime()}` : null;

  async function upload(file: File) {
    setBusy("upload");
    try {
      const body = await compress(file).catch(() => {
        throw new Error("Não conseguimos ler essa imagem. Tente outra foto.");
      });
      const res = await fetch(url, { method: "PUT", body, headers: { "Content-Type": "image/jpeg" } });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? "Não foi possível enviar a foto.");
      toast.success(receipt ? "Comprovante trocado" : "Comprovante anexado");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    const res = await fetch(url, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setOpen(false);
      toast.success("Comprovante removido");
      router.refresh();
    } else toast.error("Não foi possível remover o comprovante.");
  }

  if (!receipt && !canManage) return null;

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void upload(file);
      }}
    />
  );

  if (!receipt || !src) {
    return (
      <>
        {picker}
        <Button type="button" variant="outline" className="w-full border-dashed" disabled={busy !== null} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />} Anexar foto do comprovante
        </Button>
      </>
    );
  }

  return (
    <>
      {picker}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="focus-visible:ring-ring overflow-hidden rounded-xl border-2 outline-none focus-visible:ring-2" aria-label="Ver comprovante">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem privada servida por rota autenticada */}
          <img src={src} alt="" className="size-20 object-cover" />
        </button>
        <div className="flex flex-1 flex-col items-start gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Ver comprovante
          </Button>
          {canManage ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => input.current?.click()}>
              {busy === "upload" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />} Trocar foto
            </Button>
          ) : null}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem privada servida por rota autenticada */}
          <img src={src} alt="Foto do comprovante" className="max-h-[70dvh] w-full rounded-xl object-contain" />
          {canManage ? (
            <Button type="button" variant="ghost" className="text-destructive" disabled={busy !== null} onClick={remove}>
              {busy === "delete" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} Remover comprovante
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
