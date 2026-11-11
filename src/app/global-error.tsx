"use client";

import { useEffect } from "react";

/** Último recurso (o layout raiz falhou): HTML mínimo, sem depender de nada do app. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void fetch("/api/erros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: error.name, message: error.message, digest: error.digest, path: location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#fff8ee", color: "#172d40" }}>
        <main style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 24 }}>O Meluno não conseguiu abrir</h1>
          <p>Já fomos avisados. Tente de novo em instantes.</p>
          {error.digest ? <p style={{ fontFamily: "monospace", fontSize: 12 }}>Código: {error.digest}</p> : null}
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", borderRadius: 12, border: 0, background: "#172d40", color: "#fff", fontWeight: 700 }}>
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
