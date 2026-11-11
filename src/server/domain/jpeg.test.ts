import { describe, expect, it } from "vitest";
import { JpegError, stripJpegMetadata } from "./jpeg";

const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const text = (s: string) => [...Buffer.from(s, "latin1")];

// JPEG sintético: SOI, APP0 (JFIF), APP1 (EXIF com "GPS"), COM, DQT, SOS + dados + EOI.
const jfif = seg(0xe0, text("JFIF\0"));
const exif = seg(0xe1, text("Exif\0\0GPS-23.55,-46.63"));
const com = seg(0xfe, text("tirada em casa"));
const dqt = seg(0xdb, [0, 1, 2, 3]);
const sos = seg(0xda, [1, 1, 0]);
const scan = [0x12, 0xff, 0x00, 0x34]; // 0xFF00 é byte escapado dentro dos dados
const file = Uint8Array.from([0xff, 0xd8, ...jfif, ...exif, ...com, ...dqt, ...sos, ...scan, 0xff, 0xd9]);

describe("limpeza de JPEG", () => {
  it("remove EXIF/GPS e comentários e mantém o resto byte a byte", () => {
    const out = stripJpegMetadata(file);
    expect(Buffer.from(out).toString("latin1")).not.toMatch(/GPS|Exif|casa/);
    expect([...out]).toEqual([0xff, 0xd8, ...jfif, ...dqt, ...sos, ...scan, 0xff, 0xd9]);
  });

  it("recusa o que não é JPEG ou está truncado", () => {
    expect(() => stripJpegMetadata(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toThrow(JpegError);
    expect(() => stripJpegMetadata(file.subarray(0, 20))).toThrow(JpegError);
    expect(() => stripJpegMetadata(file.subarray(0, file.length - 2))).toThrow(/incompleto/);
  });
});
