import { ImageResponse } from "next/og";
import { previewInvitationPublic } from "@/server/services/invitations";

export const alt = "Convite para um grupo no Meluno";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Nunito (a fonte de títulos do app), em 600 e 800, buscada do Google Fonts na primeira imagem
 * e guardada em memória. Se falhar, a imagem sai com a fonte padrão — nunca quebra a prévia.
 */
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 600 | 800 }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([600, 800] as const).map(async (weight) => {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Nunito:wght@${weight}&display=swap`, { signal: AbortSignal.timeout(3000) })).text();
      const url = /src: url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(css)?.[1];
      if (!url) throw new Error("fonte não encontrada");
      return { name: "Nunito", data: await (await fetch(url, { signal: AbortSignal.timeout(3000) })).arrayBuffer(), weight };
    }),
  ).catch(() => {
    fonts = null; // tenta de novo na próxima
    return [];
  });
  return fonts;
}

/** Imagem da prévia do link de convite: nome do grupo bem grande, quem convidou e a marca. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await previewInvitationPublic(token);
  const valid = p.state === "VALID";
  const group = valid ? p.groupName : "Dividir despesas sem climão";
  const line = valid ? `${p.inviterName} convidou você · ${p.memberCount} ${p.memberCount === 1 ? "pessoa" : "pessoas"} no grupo` : "Organize gastos, compartilhe contas e descubra quem deve para quem.";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#fff8ee", color: "#172d40", fontFamily: "Nunito", fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>
          meluno<span style={{ color: "#1fa36d" }}>.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 34, color: "#6b655c" }}>{valid ? "Convite para o grupo" : "Meluno"}</div>
          <div style={{ fontSize: group.length > 28 ? 68 : 88, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{group}</div>
          <div style={{ fontSize: 32, color: "#3d4a52" }}>{line}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", padding: "14px 28px", borderRadius: 999, background: "#3fcf8e", color: "#0f2e22", fontSize: 30, fontWeight: 800 }}>Entrar no grupo</div>
          <div style={{ fontSize: 26, color: "#6b655c" }}>O Meluno não movimenta dinheiro.</div>
        </div>
      </div>
    ),
    { ...size, fonts: await loadFonts() },
  );
}
