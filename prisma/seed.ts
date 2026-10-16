import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, roles_role_name } from "@prisma/client";
import { POOL_CUSTODIAN_ID } from "../server/shared/constants/poolCustodian";
import { DEMO_ACCOUNTS, DEMO_ASSETS, DEMO_LABS } from "./seedData";
import { describeSeedTarget, parseSeedTarget, readSeedPassword, SeedRefused, type SeedTarget } from "./seedTarget";

// The server finds an asset's campus and lab by splitting its record's location on space, em dash, space
// (server/features/assets/assets.service.ts). Written as an escape so this file holds no literal em dash.
const LOCATION_SEPARATOR = " — ";

/** Every table prisma/migrations/0_init creates. The seed needs all of them, and fills only empty ones. */
const REQUIRED_TABLES = [
  "asset_disposals", "asset_loans", "asset_monetary", "asset_records", "asset_repairs", "asset_reports", "asset_returns",
  "asset_transfers", "assets", "projects", "research_centers", "roles", "user_centers", "user_roles", "users",
];

/** Tables that must be empty: the seed never merges into data that is already there, and never deletes. */
const MUST_BE_EMPTY = ["users", "roles", "research_centers", "assets"] as const;

const CAMPUS_TEXT = { MANILA: "Manila", LAGUNA: "Laguna" } as const;

function connect(target: SeedTarget): PrismaClient {
  const adapter = new PrismaMariaDb({ ...target, connectionLimit: 2, allowPublicKeyRetrieval: true });
  return new PrismaClient({ adapter });
}

/**
 * Refuses unless the open connection is on the named database, the migrations have built its tables,
 * and the seeded tables are empty.
 *
 * @throws SeedRefused naming the first check that failed
 */
async function checkDatabase(prisma: PrismaClient, target: SeedTarget): Promise<void> {
  const [row] = await prisma.$queryRaw<{ name: string | null }[]>`SELECT DATABASE() AS name`;
  // MySQL on Windows stores database names in lower case, so the comparison ignores case.
  if (row?.name?.toLowerCase() !== target.database.toLowerCase()) {
    throw new SeedRefused("the open connection is not on the database SEED_DATABASE_URL names.");
  }

  const present = new Set(
    (
      await prisma.$queryRaw<{ name: string }[]>`
        SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
    ).map((t) => t.name.toLowerCase()),
  );
  const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
  if (missing.length > 0) {
    throw new SeedRefused(
      `the database has no tables ${missing.join(", ")}. Build them first with prisma migrate deploy (PRISMA_TARGET_URL set to the same URL).`,
    );
  }

  for (const table of MUST_BE_EMPTY) {
    const [{ count }] = await prisma.$queryRawUnsafe<{ count: bigint | number }[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
    if (Number(count) > 0) {
      throw new SeedRefused(`the table ${table} already has rows. The seed fills an empty database only.`);
    }
  }
}

/** Writes roles, labs, demo accounts, and demo assets, all in one transaction, so a failure leaves the database empty. */
async function writeDemoData(prisma: PrismaClient, password: string): Promise<void> {
  const roleNames = Object.values(roles_role_name);
  const roleId = new Map(roleNames.map((name, i) => [name, i + 1]));
  const labs = DEMO_LABS.map((lab, i) => ({ ...lab, centerId: i + 1 }));
  const labByCode = new Map(labs.map((lab) => [lab.shortCode, lab]));

  await prisma.$transaction(
    async (tx) => {
      await tx.roles.createMany({ data: roleNames.map((name) => ({ role_id: roleId.get(name)!, role_name: name })) });
      await tx.research_centers.createMany({
        data: labs.map((lab) => ({ center_id: lab.centerId, name: lab.name, short_code: lab.shortCode, location: lab.location })),
      });

      await tx.users.createMany({
        data: DEMO_ACCOUNTS.map((a) => ({
          user_id: a.userId,
          first_name: "Demo",
          last_name: a.lastName,
          email: a.email,
          password,
          id_number: 80000000 + a.userId,
          user_type: a.userType,
        })),
      });
      await tx.user_roles.createMany({ data: DEMO_ACCOUNTS.map((a) => ({ user_id: a.userId, role_id: roleId.get(a.role)! })) });
      await tx.user_centers.createMany({
        data: DEMO_ACCOUNTS.filter((a) => a.lab).map((a) => ({ user_id: a.userId, center_id: labByCode.get(a.lab!)!.centerId })),
      });

      const assets = DEMO_ASSETS.map(([tag, name, serial, manufacturer, category, procured, warranty, funding, value], i) => {
        const lab = labByCode.get(tag.split("-")[0]);
        if (!lab) throw new Error(`Demo asset ${tag} names no known lab.`);
        return { assetId: i + 1, tag, name, serial, manufacturer, category, procured, warranty, funding, value, lab };
      });
      await tx.assets.createMany({
        data: assets.map((a) => ({
          asset_id: a.assetId,
          asset_tag: a.tag,
          name: a.name,
          serial_number: a.serial,
          manufacturer: a.manufacturer,
          category: a.category,
          procurement_date: new Date(a.procured),
          warranty_expiry: new Date(a.warranty),
        })),
      });
      await tx.asset_monetary.createMany({
        data: assets.map((a) => ({ asset_id: a.assetId, funding_source: a.funding, acquisition_value: a.value })),
      });
      // One ACTIVE record per asset, at home in its lab, held by nobody (the placeholder user).
      await tx.asset_records.createMany({
        data: assets.map((a) => {
          const home = `${CAMPUS_TEXT[a.lab.location]}${LOCATION_SEPARATOR}${a.lab.shortCode}`;
          return {
            asset_id: a.assetId,
            status: "ACTIVE" as const,
            asset_condition: "PERFECT" as const,
            location: home,
            current_location: home,
            current_custodian: POOL_CUSTODIAN_ID,
          };
        }),
      });
    },
    { timeout: 60_000 },
  );
}

async function main(): Promise<void> {
  const target = parseSeedTarget(process.env.SEED_DATABASE_URL);
  const password = readSeedPassword(process.env.SEED_PASSWORD);
  console.log(`[seed] Target: ${describeSeedTarget(target)}`);

  const prisma = connect(target);
  try {
    await checkDatabase(prisma, target);
    await writeDemoData(prisma, password);
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `[seed] Done: ${Object.values(roles_role_name).length} roles, ${DEMO_LABS.length} labs, ${DEMO_ACCOUNTS.length} demo accounts, ` +
      `${DEMO_ASSETS.length} demo assets held by nobody.`,
  );
  console.log(`[seed] Log in as ${DEMO_ACCOUNTS.map((a) => a.email).join(", ")}, with the password from SEED_PASSWORD.`);
}

main().catch((error) => {
  if (error instanceof SeedRefused) {
    console.error(`[seed] ${error.message}`);
  } else {
    // A Prisma error can quote the values it was given, the demo password among them.
    const secrets = [process.env.SEED_PASSWORD, process.env.SEED_DATABASE_URL].filter((s): s is string => !!s);
    let text = String((error as Error)?.stack ?? error);
    for (const secret of secrets) text = text.split(secret).join("<hidden>");
    try {
      const dbPassword = decodeURIComponent(new URL(process.env.SEED_DATABASE_URL ?? "").password);
      if (dbPassword) text = text.split(dbPassword).join("<hidden>");
    } catch {
      // No URL to take a password from: nothing more to hide.
    }
    console.error(`[seed] Failed. Nothing was kept: every write runs in one transaction.\n${text}`);
  }
  process.exit(1);
});
