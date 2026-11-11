import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import type { Viewer } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { enforceRateLimit } from "@/server/rate-limit";
import { buildImport, NfceError, parseNfcePage, parseNfceQr, type NfceImport, type NfcePage } from "@/server/domain/nfce";

export const readNfceSchema = z.object({ qr: z.string().trim().min(20).max(1000) });

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/**
 * Lê a NFC-e a partir do conteúdo do QR Code.
 * Sempre devolve o que conseguir: se a SEFAZ falhar, fica só com o que o QR informa.
 */
export async function readNfce(viewer: Viewer, input: z.infer<typeof readNfceSchema>): Promise<NfceImport> {
  let qr;
  try {
    qr = parseNfceQr(input.qr);
  } catch (error) {
    if (error instanceof NfceError) throw new AppError("VALIDATION", error.message);
    throw error;
  }

  await enforceRateLimit(`nfce:${viewer.userId}`, 20, 10 * 60);

  let page: NfcePage | null = null;
  if (qr.url) {
    try {
      page = parseNfcePage(await fetchSefazPage(qr.url));
      if (page.items.length === 0) logger.warn("nfce.no_items", { uf: qr.key.uf, host: qr.url.hostname });
    } catch (error) {
      // Sem detalhes da nota no log: só o estado e o motivo.
      logger.warn("nfce.fetch_failed", { uf: qr.key.uf, host: qr.url.hostname, reason: error instanceof Error ? error.message.slice(0, 80) : "unknown" });
    }
  }
  return buildImport(qr, page);
}

/**
 * Busca a página de consulta pública com proteção contra SSRF:
 * - só hosts de governo (`*.gov.br`), portas padrão, http/https;
 * - o DNS não pode apontar para rede interna (loopback, privada, link-local…);
 * - redirecionamentos são seguidos manualmente e revalidados;
 * - tempo e tamanho de resposta limitados.
 */
async function fetchSefazPage(start: URL): Promise<string> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicGovHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Meluno/1.0)", Accept: "text/html", "Accept-Language": "pt-BR" },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("redirect without location");
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    return decode(await readLimited(res), res.headers.get("content-type"));
  }
  throw new Error("too many redirects");
}

async function assertPublicGovHost(url: URL) {
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("port");
  if (url.username || url.password) throw new Error("credentials");
  if (isIP(host) || !host.endsWith(".gov.br")) throw new Error("host not allowed");
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("private address");
}

export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("response too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Várias SEFAZ ainda respondem em ISO-8859-1. */
function decode(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType ?? "")?.[1];
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  const charset = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
