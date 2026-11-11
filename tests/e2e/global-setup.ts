import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import { E2E_DATABASE_URL, E2E_PASSWORD, USERS } from "./fixtures";

/**
 * Prepara o banco meluno_e2e: cria se não existir, aplica as migrations,
 * zera as tabelas e cria os usuários de teste já com e-mail confirmado.
 */
export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!/^meluno_e2e\w*$/.test(dbName)) throw new Error(`Banco de E2E precisa se chamar meluno_e2e*: ${dbName}`);

  const adminUrl = new URL(E2E_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DIRECT_DATABASE_URL: E2E_DATABASE_URL } });

  const db = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await db.connect();
  const { rows } = await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'");
  await db.query(`TRUNCATE TABLE ${rows.map((r) => `"public"."${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

  const hash = await hashPassword(E2E_PASSWORD);
  for (const u of Object.values(USERS)) {
    const id = randomUUID();
    await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, now(), now())`, [id, u.name, u.email]);
    await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [randomUUID(), id, hash]);
    await db.query(`INSERT INTO user_preferences ("userId", "updatedAt") VALUES ($1, now())`, [id]);
  }
  await db.end();
}
