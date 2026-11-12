"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** QR Code desenhado como um único <path> a partir da matriz (sem innerHTML). Usado no Pix e nos convites. */
export function QrSvg({ value, size, label }: { value: string; size: number; label: string }) {
  const { d, n } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let path = "";
    qr.data.forEach((row, y) => row.forEach((on, x) => (on ? (path += `M${x} ${y}h1v1h-1z`) : null)));
    return { d: path, n: qr.size };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#172D40" />
    </svg>
  );
}
