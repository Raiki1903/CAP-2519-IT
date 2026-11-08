/**
 * The demo seed (npm run seed): fills an empty local database, built by prisma/migrations, with roles, labs, demo accounts,
 * demo assets in every status, and any missing lookup rows.
 * Layer: database tooling, not part of the server. Run by npm run seed. Calls seedTarget.ts, seedData.ts, seedHistory.ts,
 * Prisma with the MariaDB adapter, and the server's password helper.
 * Used by: a teammate setting up a local copy of the app (docs/guides/DATABASE-MIGRATIONS.md). Never CCS Cloud, never the tests.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, roles_role_name } from "@prisma/client";
import { hashPassword, hidePasswordHashes } from "../server/shared/services/passwords";
import {
  DEMO_ACCOUNTS,
  DEMO_ASSETS,
  DEMO_BORROWER_ID,
  DEMO_CATEGORY_METRICS,
  DEMO_FUNDING_SOURCES,
  DEMO_ISSUE_TYPES,
  DEMO_LABS,
  DEMO_METRICS,
  DEMO_TSG_ID,
} from "./seedData";
import { accountSteps, clockFor } from "./seedHistory";
import { describeSeedTarget, parseSeedTarget, readSeedPassword, SeedRefused, type SeedTarget } from "./seedTarget";

/** Every table the migrations create. The seed needs all of them, and fills only empty ones. */
const REQUIRED_TABLES = [
  "activity_log", "asset_inspection_metrics", "asset_inspections", "asset_loans", "asset_maintenance",
  "asset_remarks", "asset_retirements", "assets", "category_metrics", "funding_sources",
  "issue_types", "metric_definitions", "projects", "research_centers", "roles", "user_centers", "user_roles", "user_tickets", "users",
];

/** Tables that must be empty: the seed never merges into data that is already there, and never deletes. */
const MUST_BE_EMPTY = ["users", "roles", "research_centers", "assets"] as const;

/** The health score each condition suggests at registration. */
const HEALTH_SCORE = { PERFECT: 100, OPERATIONAL: 80, MINOR_DRIFT: 60, DEGRADED: 40, CRITICAL_DEFECT: 20 } as const;

/**
 * A Prisma client for the seed's target only. It does not import server/config/prisma.ts, which loads .env,
 * where the DATABASE_* variables point at CCS Cloud. (C-07)
 */
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** A date-time this many days before now. */
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

/**
 * Writes the lookup rows, roles, labs, demo accounts, demo assets, and the loan, maintenance ticket, retirements and
 * log row behind the assets that are not available, all in one transaction, so a failure leaves the database empty.
 * The lookup rows the migrations wrote are kept; only missing ones are added.
 */
async function writeDemoData(prisma: PrismaClient, password: string): Promise<void> {
  const roleNames = Object.values(roles_role_name);
  const roleId = new Map(roleNames.map((name, i) => [name, i + 1]));
  const labs = DEMO_LABS.map((lab, i) => ({ ...lab, centerId: i + 1 }));
  const labByCode = new Map(labs.map((lab) => [lab.shortCode, lab]));
  const clock = clockFor(new Date());
  const { decisions, activity } = accountSteps(clock);
  const passwordHashes = await Promise.all(DEMO_ACCOUNTS.map((a) => (a.anonymizedDaysAgo !== undefined ? "" : hashPassword(password))));

  await prisma.$transaction(
    async (tx) => {
      await tx.funding_sources.createMany({ data: DEMO_FUNDING_SOURCES.map((name) => ({ name })), skipDuplicates: true });
      await tx.issue_types.createMany({
        data: DEMO_ISSUE_TYPES.map(([key, name, suggested_action]) => ({ key, name, suggested_action })),
        skipDuplicates: true,
      });
      await tx.metric_definitions.createMany({
        data: DEMO_METRICS.map(([metric_key, name, unit, higher_is_better]) => ({ metric_key, name, unit, higher_is_better })),
        skipDuplicates: true,
      });
      const metricId = new Map((await tx.metric_definitions.findMany()).map((m) => [m.metric_key, m.metric_id]));
      await tx.category_metrics.createMany({
        data: DEMO_CATEGORY_METRICS.map(([category, key]) => ({ category, metric_id: metricId.get(key)! })),
        skipDuplicates: true,
      });
      const fundingId = new Map((await tx.funding_sources.findMany()).map((f) => [f.name, f.funding_source_id]));
      const issueTypeId = new Map((await tx.issue_types.findMany()).map((t) => [t.key, t.issue_type_id]));

      await tx.roles.createMany({ data: roleNames.map((name) => ({ role_id: roleId.get(name)!, role_name: name })) });
      await tx.research_centers.createMany({
        data: labs.map((lab) => ({ center_id: lab.centerId, name: lab.name, short_code: lab.shortCode, location: lab.location })),
      });

      await tx.users.createMany({
        data: DEMO_ACCOUNTS.map((a, i) => {
          // An anonymized account is written exactly as users.repository.ts anonymizeUser leaves it.
          const anonymized = a.anonymizedDaysAgo !== undefined;
          return {
            user_id: a.userId,
            first_name: anonymized ? "Former" : a.firstName,
            last_name: anonymized ? "researcher" : a.lastName,
            email: anonymized ? `anonymized-${a.userId}@invalid` : a.email,
            password: passwordHashes[i],
            id_number: anonymized ? null : 80000000 + a.userId,
            user_type: a.userType,
            account_status: a.status,
            ...decisions.get(a.userId),
          };
        }),
      });
      await tx.user_roles.createMany({
        data: DEMO_ACCOUNTS.filter((a) => a.role).map((a) => ({ user_id: a.userId, role_id: roleId.get(a.role!)! })),
      });
      await tx.user_centers.createMany({
        data: DEMO_ACCOUNTS.filter((a) => a.anonymizedDaysAgo === undefined).flatMap((a) =>
          a.labs.map((code) => ({ user_id: a.userId, center_id: labByCode.get(code)!.centerId })),
        ),
      });
      for (const head of DEMO_ACCOUNTS.filter((a) => a.heads)) {
        await tx.research_centers.update({ where: { center_id: labByCode.get(head.heads!)!.centerId }, data: { head_user_id: head.userId } });
      }

      const assets = DEMO_ASSETS.map((a, i) => {
        const lab = labByCode.get(a.tag.split("-")[0]);
        if (!lab) throw new Error(`Demo asset ${a.tag} names no known lab.`);
        return { ...a, assetId: i + 1, lab };
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
          status: a.status,
          center_id: a.lab.centerId,
          home_room: a.homeRoom,
          funding_source_id: fundingId.get(a.funding) ?? null,
          acquisition_value: a.value,
          accessories: a.accessories ?? null,
        })),
      });
      // Every asset was registered with a TSG inspection, a month before its status changed.
      await tx.asset_inspections.createMany({
        data: assets.map((a) => ({
          asset_id: a.assetId,
          inspected_by_id: DEMO_TSG_ID,
          inspected_at: daysAgo(30),
          type: "INITIAL" as const,
          condition: a.condition,
          health_score: HEALTH_SCORE[a.condition],
          remarks: "Demo: registered and tagged.",
        })),
      });

      const loanedTag = assets.find((a) => a.status === "ON_LOAN")!;
      await tx.asset_loans.create({
        data: {
          asset_id: loanedTag.assetId,
          borrower_id: DEMO_BORROWER_ID,
          purpose: "Demo: user testing sessions for a VR study.",
          requested_at: daysAgo(5),
          return_by: new Date(Date.now() + 9 * DAY_MS),
          status: "ON_LOAN",
          destination_center_id: loanedTag.lab.centerId,
          destination_room: "G410",
          decided_by_id: DEMO_ACCOUNTS.find((a) => a.heads === loanedTag.lab.shortCode)?.userId ?? null,
          decided_at: daysAgo(5),
          released_by_id: DEMO_TSG_ID,
          released_at: daysAgo(4),
        },
      });

      const inRepair = assets.find((a) => a.status === "MAINTENANCE")!;
      await tx.asset_maintenance.create({
        data: {
          asset_id: inRepair.assetId,
          reported_by_id: 9,
          issue_description: "Demo: the drive disconnects in the middle of large copies.",
          status: "INSPECTING",
          type: "BORROWER_REPORT",
          issue_type_id: issueTypeId.get("STORAGE_DATA") ?? null,
          reported_at: daysAgo(3),
          received_by_id: DEMO_TSG_ID,
          received_at: daysAgo(2),
        },
      });

      const pendingRetirement = assets.find((a) => a.status === "PENDING_RETIREMENT")!;
      await tx.asset_retirements.create({
        data: {
          asset_id: pendingRetirement.assetId,
          requested_by_id: DEMO_TSG_ID,
          requested_at: daysAgo(1),
          reason: "Demo: dead lines across the panel; the warranty has ended.",
          status: "PENDING",
          previous_status: "AVAILABLE",
        },
      });

      const retired = assets.find((a) => a.status === "RETIRED")!;
      await tx.asset_retirements.create({
        data: {
          asset_id: retired.assetId,
          requested_by_id: DEMO_TSG_ID,
          requested_at: daysAgo(20),
          reason: "Demo: the lamp and the board failed; a repair costs more than a new unit.",
          status: "COMPLETED",
          pathway: "RECYCLE",
          previous_status: "AVAILABLE",
          decided_by_id: 2,
          decided_at: daysAgo(18),
          decision_remarks: "Demo: approved for recycling.",
          completed_by_id: 5,
          completed_at: daysAgo(15),
          disposition_reference: "DEMO-DISP-0001",
        },
      });

      await tx.activity_log.createMany({ data: [...activity].sort((a, b) => a.created_at.getTime() - b.created_at.getTime()) });

      const missing = assets.find((a) => a.status === "MISSING")!;
      await tx.activity_log.create({
        data: { actor_id: DEMO_TSG_ID, event_type: "ASSET_MARKED_MISSING", asset_id: missing.assetId, details: "Demo: not found at the routine count." },
      });

    },
    { timeout: 60_000 },
  );
}

/**
 * Checks both variables before connecting, then the database, then writes. Prints the target as host:port/name only.
 *
 * @throws SeedRefused when a variable or the database fails a check (nothing is written)
 */
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
      `${DEMO_ASSETS.length} demo assets, one in each status.`,
  );
  console.log(
    `[seed] Log in as ${DEMO_ACCOUNTS.filter((a) => a.status === "ACTIVE").map((a) => a.email).join(", ")}, with the password from SEED_PASSWORD.`,
  );
  console.log("[seed] Not active (cannot log in): demo.pending (Pending), demo.rejected (Rejected), demo.researcher.l (Inactive), and one anonymized account.");
}

main().catch((error) => {
  if (error instanceof SeedRefused) {
    console.error(`[seed] ${error.message}`);
  } else {
    // A Prisma error can quote the values it was given, the demo password and its hashes among them.
    const secrets = [process.env.SEED_PASSWORD, process.env.SEED_DATABASE_URL].filter((s): s is string => !!s);
    let text = String((error as Error)?.stack ?? error);
    for (const secret of secrets) text = text.split(secret).join("<hidden>");
    try {
      const dbPassword = decodeURIComponent(new URL(process.env.SEED_DATABASE_URL ?? "").password);
      if (dbPassword) text = text.split(dbPassword).join("<hidden>");
    } catch {
      // No URL to take a password from: nothing more to hide.
    }
    console.error(`[seed] Failed. Nothing was kept: every write runs in one transaction.\n${hidePasswordHashes(text)}`);
  }
  process.exit(1);
});
