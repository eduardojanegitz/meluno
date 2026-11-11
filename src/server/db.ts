import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Cliente Prisma único por processo. Em desenvolvimento, o HMR recarrega
 * módulos; guardar no globalThis evita abrir um pool novo a cada edição.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaClass?: typeof PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Depois de `prisma generate` (nova migration), o HMR carrega uma classe nova:
// o cliente em cache seria de antes e não conheceria as tabelas novas.
const cached = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
const client = cached ?? createClient();

/**
 * Só em desenvolvimento: se o servidor ficou com um cliente de antes de uma migration
 * (cache do Turbopack, `prisma generate` com o servidor rodando no Windows…), o erro seria
 * "Cannot read properties of undefined (reading 'findMany')". Aqui vira uma instrução clara.
 */
/** Propriedades que bibliotecas consultam em qualquer objeto (não são modelos). */
const NOT_MODELS = new Set(["then", "toJSON", "toString", "valueOf", "inspect", "constructor", "nodeType", "asymmetricMatch", "tagName"]);

function withStaleClientHint(target: PrismaClient): PrismaClient {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (value === undefined && typeof prop === "string" && /^[a-z][A-Za-z]+$/.test(prop) && !NOT_MODELS.has(prop)) {
        throw new Error(`O cliente Prisma carregado não conhece "${prop}". Rode \`npx prisma generate\` e reinicie o \`npm run dev\` (o servidor ficou com o cliente de antes da migration).`);
      }
      // Métodos ($transaction, $queryRaw…) usam campos privados: chamar no objeto original.
      return typeof value === "function" ? value.bind(obj) : value;
    },
  });
}

export const db = env().NODE_ENV === "development" ? withStaleClientHint(client) : client;

if (env().NODE_ENV !== "production") {
  globalForPrisma.prisma = client;
  globalForPrisma.prismaClass = PrismaClient;
}

export type Db = typeof db;
