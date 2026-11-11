/**
 * Limpeza de JPEG sem decodificar a imagem: valida a estrutura e remove os segmentos de
 * metadados (APP1–APP15: EXIF com GPS e modelo do aparelho, XMP, IPTC…; COM: comentários).
 * Mantém APP0 (JFIF) e tudo o que é necessário para desenhar a imagem.
 *
 * O navegador já reencoda a foto (o que descarta o EXIF), mas o servidor não confia nisso.
 */
export class JpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JpegError";
  }
}

export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw new JpegError("O arquivo não é uma imagem JPEG.");
  const out: Uint8Array[] = [input.subarray(0, 2)]; // SOI
  let i = 2;

  while (i < input.length) {
    if (input[i] !== 0xff) throw new JpegError("JPEG corrompido.");
    // Bytes 0xFF de preenchimento entre marcadores são permitidos.
    while (input[i] === 0xff && input[i + 1] === 0xff) i++;
    const marker = input[i + 1];
    if (marker === undefined) throw new JpegError("JPEG incompleto.");

    if (marker === 0xd9) {
      out.push(input.subarray(i, i + 2)); // EOI
      return concat(out);
    }
    // Marcadores sem tamanho (TEM, RSTn).
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > input.length) throw new JpegError("JPEG incompleto.");
    const length = (input[i + 2]! << 8) | input[i + 3]!;
    if (length < 2) throw new JpegError("JPEG corrompido.");
    const end = i + 2 + length;
    if (end > input.length) throw new JpegError("JPEG incompleto.");

    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) out.push(input.subarray(i, end));

    if (marker === 0xda) {
      // Início dos dados da imagem: copia até o fim (o EOI vem no final).
      const rest = input.subarray(end);
      if (rest.length < 2 || rest[rest.length - 2] !== 0xff || rest[rest.length - 1] !== 0xd9) throw new JpegError("JPEG incompleto.");
      out.push(rest);
      return concat(out);
    }
    i = end;
  }
  throw new JpegError("JPEG incompleto.");
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
