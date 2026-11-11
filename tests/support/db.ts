import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Cliente Prisma apontado para o banco de testes. */
export function createTestDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não definida.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export type TestDb = ReturnType<typeof createTestDb>;

/** Limpa todas as tabelas da aplicação (exceto o histórico de migrations). */
export async function resetDb(db: TestDb) {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
