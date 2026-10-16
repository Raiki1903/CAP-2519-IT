/**
 * Direct database access for the tests: a Prisma client aimed at the guarded test database, the drop before the migrations, and the reset between files.
 * Layer: test setup. Called by globalSetup.ts, harness.ts, and tests that read rows back. Calls testDatabase.ts and Prisma.
 * Used by: every test run (the drop) and every API test file, to seed data and check what a request wrote.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { loadTestDatabaseConfig, TestDatabaseRefused, type TestDatabaseConfig } from "./testDatabase";

/**
 * Builds a Prisma client for the test database.
 * It does not import the app's server/config/prisma.ts, which loads .env, where the DATABASE_* variables point at CCS Cloud. (C-07)
 *
 * @param config the guarded connection details; read from TEST_DATABASE_URL when omitted
 * @throws TestDatabaseRefused when TEST_DATABASE_URL fails the guard
 */
export function createTestPrisma(config: TestDatabaseConfig = loadTestDatabaseConfig()): PrismaClient {
  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

/**
 * Confirms the open connection really is on the expected `_test` database before anything is deleted.
 * A second check after the URL guard, in case a default database or proxy changed the target.
 *
 * @returns the database name exactly as MySQL stores it (lower case on Windows)
 * @throws TestDatabaseRefused when the connected database is not the configured `_test` one
 */
export async function assertConnectedToTestDatabase(prisma: PrismaClient, config: TestDatabaseConfig): Promise<string> {
  const [row] = await prisma.$queryRaw<{ name: string | null }[]>`SELECT DATABASE() AS name`;
  // MySQL on Windows stores database names in lower case, so the comparison ignores case.
  const connected = row?.name;
  if (!connected || connected.toLowerCase() !== config.database.toLowerCase() || !connected.toLowerCase().endsWith("_test")) {
    throw new TestDatabaseRefused("the open connection is not on the configured _test database.");
  }
  return connected;
}

/**
 * Drops every table in the test database, Prisma's migration record included, so the migrations can
 * build it again from nothing. Foreign keys go first, so the tables can then be dropped in any order.
 *
 * @returns the database name exactly as MySQL stores it
 * @throws TestDatabaseRefused when the connection is not on the test database
 */
export async function dropAllTables(prisma: PrismaClient, config: TestDatabaseConfig): Promise<string> {
  const storedName = await assertConnectedToTestDatabase(prisma, config);

  const foreignKeys = await prisma.$queryRaw<{ tableName: string; name: string }[]>`
    SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY'`;
  for (const { tableName, name } of foreignKeys) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${name}\``);
  }

  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`;
  for (const { name } of tables) {
    await prisma.$executeRawUnsafe(`DROP TABLE \`${name}\``);
  }
  return storedName;
}

/**
 * Empties every table in the test database and restarts each id counter at 1,
 * so ids in the seed are the same in every file.
 * Tables are read from the database, so a table added by a later migration is emptied too.
 * Prisma's migration record (_prisma_migrations) is left alone: it says which migrations built the tables.
 *
 * @returns the database name exactly as MySQL stores it
 * @throws TestDatabaseRefused when the connection is not on the test database
 */
export async function resetDatabase(prisma: PrismaClient, config: TestDatabaseConfig): Promise<string> {
  const storedName = await assertConnectedToTestDatabase(prisma, config);

  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> '_prisma_migrations'`;

  // Foreign key checks are a per-connection setting, so the deletes run in one
  // transaction to stay on the connection where the checks are off.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
      for (const { name } of tables) {
        await tx.$executeRawUnsafe(`DELETE FROM \`${name}\``);
      }
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
    },
    { timeout: 30_000 },
  );

  // ALTER TABLE commits on its own in MySQL, so it cannot run inside the transaction above.
  for (const { name } of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${name}\` AUTO_INCREMENT = 1`);
  }
  return storedName;
}
