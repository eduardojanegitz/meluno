import type { ExpenseCategory } from "./categories";

/** Sugestão de categoria pela descrição (o usuário sempre pode trocar). */
const rules: [RegExp, ExpenseCategory][] = [
  [/\b(mercado|supermercado|feira|hortifruti|a[cç]ougue|padaria|atacad)/, "GROCERIES"],
  [/\b(uber|99|taxi|t[aá]xi|gasolina|combust|ped[aá]gio|estacionamento|[oô]nibus|metr[oô]|passagem de [oô]nibus)/, "TRANSPORT"],
  [/\b(aluguel|condom[ií]nio|iptu|diarista|faxina|m[oó]veis)/, "HOUSING"],
  [/\b(luz|energia|[aá]gua|internet|g[aá]s|telefone|celular|streaming|netflix|spotify)/, "UTILITIES"],
  [/\b(restaurante|almo[cç]o|jantar|caf[eé]|lanche|pizza|hamb[uú]rguer|bar|churrasco|ifood|sushi|a[cç]a[ií])/, "FOOD"],
  [/\b(hotel|pousada|airbnb|hospedagem|passagem|voo|aeroporto|viagem)/, "TRAVEL"],
  [/\b(show|ingresso|festival|teatro|jogo|est[aá]dio)/, "EVENTS"],
  [/\b(cinema|passeio|parque|museu|balada|festa)/, "LEISURE"],
];

/** "  Açaí da Praça " → "acai da praca": chave para lembrar categorias já usadas. */
export function normalizeDescription(description: string): string {
  return description.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

/**
 * 1º: a categoria usada da última vez no grupo para a mesma descrição ("Feira do sábado" → Mercado);
 * 2º: palavras-chave. O usuário sempre pode trocar.
 */
export function suggestCategory(description: string, history?: Record<string, ExpenseCategory>): ExpenseCategory | null {
  const learned = history?.[normalizeDescription(description)];
  if (learned) return learned;
  const text = description.toLocaleLowerCase("pt-BR");
  for (const [re, cat] of rules) if (re.test(text)) return cat;
  return null;
}
