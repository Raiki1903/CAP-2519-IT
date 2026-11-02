/**
 * The one-time password upgrade: hashes every users.password that is not a hash yet. (C-03, issue #10)
 * Layer: database tooling, not part of the server. Run with tsx. Calls hashTarget.ts, the server's password helper, and Prisma with the MariaDB adapter.
 * Used by: anyone with a local copy of plain-text data, and the Nov 8 deploy if the existing data is kept (docs/guides/DATABASE-MIGRATIONS.md).
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { hashPassword, isPasswordHash } from "../server/shared/services/passwords";
import { parseHashTarget } from "./hashTarget";
import { SeedRefused } from "./seedTarget";

/**
 * Hashes the plain rows one at a time, so a failure part way loses nothing: running the script again finishes the rest.
 *
 * @returns how many rows were hashed and how many already held a hash
 */
async function hashPlainRows(prisma: PrismaClient): Promise<{ hashed: number; skipped: number }> {
  const rows = await prisma.users.findMany({ select: { user_id: true, password: true } });
  let hashed = 0;
  let skipped = 0;
  for (const row of rows) {
    if (isPasswordHash(row.password)) {
      skipped += 1;
      continue;
    }
    await prisma.users.update({ where: { user_id: row.user_id }, data: { password: await hashPassword(row.password) } });
    hashed += 1;
  }
  return { hashed, skipped };
}

/**
 * Checks the target, connects, and hashes. Prints only the two counts.
 *
 * @throws SeedRefused when HASH_TARGET_URL fails its check (nothing is written)
 */
async function main(): Promise<void> {
  // It does not import server/config/prisma.ts, which loads .env, where the DATABASE_* variables point at CCS Cloud. (C-07)
  const target = parseHashTarget(process.env.HASH_TARGET_URL, process.argv.slice(2));
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb({ ...target, connectionLimit: 2, allowPublicKeyRetrieval: true }) });
  try {
    const { hashed, skipped } = await hashPlainRows(prisma);
    console.log(`[hash] hashed: ${hashed}, skipped: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  if (error instanceof SeedRefused) {
    console.error(`[hash] ${error.message}`);
  } else {
    // Only the type and code: a database error can quote the values it was given.
    const code = (error as { code?: unknown })?.code;
    console.error(`[hash] Failed (${(error as Error)?.name ?? "unknown error"}${code ? `, ${String(code)}` : ""}). Rows hashed so far stay hashed: run it again to finish.`);
  }
  process.exit(1);
});
