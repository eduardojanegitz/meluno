/**
 * Pix "Copia e Cola" estático (BR Code / EMV-MPM), conforme o Manual de
 * Padrões para Iniciação do Pix do Banco Central.
 *
 * Gerado localmente, sem PSP e sem integração bancária: o app do banco de
 * quem paga lê o código e preenche chave, valor e identificação. O Meluno
 * nunca movimenta dinheiro nem fica sabendo se o pagamento aconteceu — por
 * isso, depois de pagar, a pessoa toca em "Já paguei" e o recebedor confirma.
 */

export type PixPayloadInput = {
  /** Chave já normalizada (CPF/CNPJ só dígitos, telefone +55…, e-mail minúsculo, EVP). */
  key: string;
  /** Nome de quem recebe (até 25 caracteres, sem acentos). */
  name: string;
  /** Cidade de quem recebe (até 15 caracteres). Campo obrigatório do padrão. */
  city?: string;
  /** Valor em centavos; omitido = a pessoa digita no banco. */
  amountMinor?: number;
  /** Mensagem exibida no app do banco (opcional). */
  description?: string;
  /** Identificador da transação; "***" quando não há. */
  txid?: string;
};

/** Remove acentos e caracteres fora do conjunto aceito pelos bancos. */
export function sanitizePixText(text: string, max: number) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-/@]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

function field(id: string, value: string) {
  if (value.length > 99) throw new Error(`Campo ${id} do Pix excede 99 caracteres.`);
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF), em 4 dígitos hexadecimais maiúsculos. */
export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(input: PixPayloadInput) {
  const name = sanitizePixText(input.name, 25) || "RECEBEDOR";
  const city = sanitizePixText(input.city ?? "BRASIL", 15) || "BRASIL";
  const txid = (input.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";

  let account = field("00", "br.gov.bcb.pix") + field("01", input.key);
  if (input.description) {
    const room = 99 - account.length - 4;
    const desc = sanitizePixText(input.description, Math.max(0, room));
    if (desc) account += field("02", desc);
  }

  let payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (input.amountMinor && input.amountMinor > 0 ? field("54", `${Math.trunc(input.amountMinor / 100)}.${String(input.amountMinor % 100).padStart(2, "0")}`) : "") +
    field("58", "BR") +
    field("59", name) +
    field("60", city) +
    field("62", field("05", txid));

  payload += "6304";
  return payload + crc16(payload);
}
