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
export const db = cached ?? createClient();

if (env().NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaClass = PrismaClient;
}

export type Db = typeof db;
