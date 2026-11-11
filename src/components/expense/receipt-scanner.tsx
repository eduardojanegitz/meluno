"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { readNfceAction } from "@/server/actions/finance";
import type { NfceImport } from "@/server/domain/nfce";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> };

/**
 * Decodifica QR de um quadro. Usa o leitor nativo do navegador (Chrome/Android) e,
 * onde ele não existe (iPhone, Firefox), o jsQR, carregado só quando preciso.
 */
async function makeDecoder(): Promise<(source: HTMLVideoElement | HTMLImageElement, canvas: HTMLCanvasElement) => Promise<string | null>> {
  const Native = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (Native && (await Native.getSupportedFormats?.())?.includes("qr_code")) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (source) => (await detector.detect(source))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  return async (source, canvas) => {
    const w = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 800 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

export function ReceiptScanner({ onImport }: { onImport: (data: NfceImport) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ReceiptText aria-hidden="true" /> Ler nota fiscal
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ler nota fiscal</DialogTitle>
            <DialogDescription>Aponte a câmera para o QR Code da NFC-e, aquele no pé do cupom.</DialogDescription>
          </DialogHeader>
          {open ? (
            <ScannerBody
              onDone={(data) => {
                setOpen(false);
                onImport(data);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ScannerBody({ onDone }: { onDone: (data: NfceImport) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "unavailable">("starting");
  const [manual, setManual] = useState("");
  const read = useAction(readNfceAction);
  const busy = useRef(false);

  const submit = async (qr: string): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    const result = await read.run({ qr });
    busy.current = false;
    if (result.ok) onDone(result.data);
    return result.ok;
  };
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  // Câmera traseira + leitura contínua (~6 quadros por segundo).
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera api");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setCamera("on");
        const decode = await makeDecoder();
        const tick = async () => {
          if (stopped) return;
          if (!busy.current) {
            const value = await decode(video, canvasRef.current!).catch(() => null);
            if (value && !stopped) {
              // Deu certo: o diálogo fecha. Deu errado (ex.: QR do Pix): espera e volta a ler.
              if (await submitRef.current(value)) return;
              timer = setTimeout(tick, 2000);
              return;
            }
          }
          timer = setTimeout(tick, 160);
        };
        void tick();
      } catch {
        if (!stopped) setCamera("unavailable");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const fromPhoto = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const value = await (await makeDecoder())(img, canvasRef.current!);
      if (value) await submit(value);
      else toast.error("Não encontramos um QR Code nessa foto. Tente uma foto mais de perto.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-ink relative aspect-square overflow-hidden rounded-2xl">
        <video ref={videoRef} playsInline muted className="size-full object-cover" aria-label="Câmera" />
        <canvas ref={canvasRef} className="hidden" />
        {camera === "on" && !read.pending ? (
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" aria-hidden="true" />
        ) : null}
        {camera === "starting" ? (
          <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
            <span className="flex items-center gap-2">
              <Camera className="size-4" aria-hidden="true" /> Abrindo a câmera…
            </span>
          </p>
        ) : null}
        {camera === "unavailable" ? (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/85">
            Não conseguimos usar a câmera. Libere o acesso nas configurações do navegador, ou use uma foto ou o link abaixo.
          </p>
        ) : null}
        {read.pending ? (
          <div className="bg-ink/80 absolute inset-0 grid place-items-center text-white" role="status">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Buscando a nota na SEFAZ…
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void fromPhoto(file);
          }}
        />
        <Button type="button" variant="secondary" disabled={read.pending} onClick={() => fileRef.current?.click()}>
          <ImageUp aria-hidden="true" /> Usar uma foto do QR Code
        </Button>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            // O diálogo é um portal, mas o evento do React sobe até o formulário da despesa: não deixar salvar.
            e.stopPropagation();
            if (manual.trim()) void submit(manual.trim());
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ou cole o link ou a chave de acesso" aria-label="Link do QR Code ou chave de acesso" className="h-10 flex-1" />
          <Button type="submit" variant="outline" disabled={read.pending || manual.trim().length < 20}>
            Buscar
          </Button>
        </form>
      </div>
    </div>
  );
}
