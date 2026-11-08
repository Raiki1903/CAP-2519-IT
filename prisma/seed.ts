/**
 * The demo seed (npm run seed): fills an empty local database, built by prisma/migrations, with roles, labs, demo accounts,
 * projects, demo assets with their history, and any missing lookup rows.
 * Layer: database tooling, not part of the server. Run by npm run seed. Calls seedTarget.ts, seedData.ts, seedHistory.ts,
 * seedStory.ts, seedImages.ts, Prisma with the MariaDB adapter, and the server's password helper.
 * Used by: a teammate setting up a local copy of the app (docs/guides/DATABASE-MIGRATIONS.md). Never CCS Cloud, never the tests.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, roles_role_name } from "@prisma/client";
import { hashPassword, hidePasswordHashes } from "../server/shared/services/passwords";
import {
  DEMO_ACCOUNTS,
  DEMO_ASSETS,
  DEMO_CATEGORY_METRICS,
  DEMO_FUNDING_SOURCES,
  DEMO_ISSUE_TYPES,
  DEMO_LAB_ROOMS,
  DEMO_LABS,
  DEMO_METRICS,
  DEMO_PROJECTS,
} from "./seedData";
import { clockFor, nameOf, SEEDED_ASSETS } from "./seedHistory";
import { buildHistory } from "./seedStory";
import { categoryPicture, photoFor, photoKeyOf, readSeedPhotosDir } from "./seedImages";
import { describeSeedTarget, parseSeedTarget, readSeedPassword, SeedRefused, type SeedTarget } from "./seedTarget";

/** Every table the migrations create. The seed needs all of them, and fills only empty ones. */
const REQUIRED_TABLES = [
  "activity_log", "asset_inspection_metrics", "asset_inspections", "asset_loans", "asset_maintenance",
  "asset_remarks", "asset_retirements", "assets", "category_metrics", "funding_sources",
  "issue_types", "metric_definitions", "projects", "research_centers", "roles", "user_centers", "user_roles", "user_tickets", "users",
];

/** Tables that must be empty: the seed never merges into data that is already there, and never deletes. */
const MUST_BE_EMPTY = ["users", "roles", "research_centers", "assets"] as const;

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

/** Splits rows into chunks, so one INSERT never grows past MySQL's packet limit with photos in it. */
function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** Sorts rows by a date, oldest first, and keeps the order of rows with the same date. */
function byTime<T>(rows: T[], timeOf: (row: T) => Date): T[] {
  return rows.map((row, i) => ({ row, i })).sort((a, b) => timeOf(a.row).getTime() - timeOf(b.row).getTime() || a.i - b.i).map((x) => x.row);
}

/**
 * Writes the lookup rows, roles, labs, demo accounts, projects, demo assets and their history (seedHistory.ts), all in
 * one transaction, so a failure leaves the database empty. Each history table gets its ids in time order, as the app
 * would have given them. The lookup rows the migrations wrote are kept; only missing ones are added.
 */
async function writeDemoData(prisma: PrismaClient, password: string, photosDir: string | null): Promise<number> {
  const roleNames = Object.values(roles_role_name);
  const roleId = new Map(roleNames.map((name, i) => [name, i + 1]));
  const labs = DEMO_LABS.map((lab, i) => ({ ...lab, centerId: i + 1 }));
  const labByCode = new Map(labs.map((lab) => [lab.shortCode, lab]));
  const projectId = new Map(DEMO_PROJECTS.map((p, i) => [p.code, i + 1]));
  const clock = clockFor(new Date());
  const history = buildHistory(clock);
  const passwordHashes = await Promise.all(DEMO_ACCOUNTS.map((a) => (a.anonymizedDaysAgo !== undefined ? "" : hashPassword(password))));

  const photos = new Map(SEEDED_ASSETS.map((a) => [a.assetId, photoFor(photosDir, a.photo ?? photoKeyOf(a.name))]));
  const inspections = byTime(history.inspections, (r) => r.inspected_at);
  inspections.forEach((row, i) => (row.id = i + 1));

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
            ...history.decisions.get(a.userId),
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

      await tx.projects.createMany({
        data: DEMO_PROJECTS.map((p) => ({
          project_id: projectId.get(p.code)!,
          project_code: p.code,
          project_name: p.name,
          project_leader: nameOf(DEMO_ACCOUNTS.find((a) => a.heads === p.lab)!),
          center_id: labByCode.get(p.lab)!.centerId,
          funding_source_id: fundingId.get(p.funding) ?? null,
          start_date: new Date(p.start),
          end_date: new Date(p.end),
        })),
      });

      for (const batch of chunks(SEEDED_ASSETS, 10)) {
        await tx.assets.createMany({
          data: batch.map((a) => ({
            asset_id: a.assetId,
            asset_tag: a.tag,
            name: a.name,
            serial_number: a.serial,
            manufacturer: a.manufacturer,
            category: a.category,
            procurement_date: new Date(a.procured),
            warranty_expiry: typeof a.warranty === "string" ? new Date(a.warranty) : clock.day(-a.warranty.daysFromSeed),
            image_url: photos.get(a.assetId) ?? categoryPicture(a.category),
            status: history.statuses.get(a.assetId) ?? "AVAILABLE",
            center_id: labByCode.get(a.lab)!.centerId,
            home_room: DEMO_LAB_ROOMS[a.lab],
            project_id: a.project ? projectId.get(a.project)! : null,
            funding_source_id: fundingId.get(a.funding) ?? null,
            acquisition_value: a.value,
            accessories: a.accessories ?? null,
            its_property_tag: a.its ?? null,
          })),
        });
      }

      for (const batch of chunks(inspections, 200)) {
        await tx.asset_inspections.createMany({
          data: batch.map(({ id, metrics: _metrics, ...row }) => ({ inspection_id: id, ...row })),
        });
      }
      await tx.asset_inspection_metrics.createMany({
        data: inspections.flatMap((row) =>
          Object.entries(row.metrics).map(([key, value]) => ({ inspection_id: row.id!, metric_id: metricId.get(key)!, value })),
        ),
      });

      const issueTypeId = new Map((await tx.issue_types.findMany()).map((t) => [t.key, t.issue_type_id]));
      const centerOf = (code: string) => labByCode.get(code)!.centerId;
      const loans = byTime(history.loans, (r) => r.requested_at);
      await tx.asset_loans.createMany({
        data: loans.map(({ projectCode, destinationLab, releaseInspection, returnInspection, ...row }, i) => ({
          loan_id: i + 1,
          ...row,
          project_id: projectCode ? projectId.get(projectCode)! : null,
          destination_center_id: centerOf(destinationLab),
          release_inspection_id: releaseInspection?.id ?? null,
          return_inspection_id: returnInspection?.id ?? null,
        })),
      });
      const tickets = byTime(history.tickets, (r) => r.reported_at);
      await tx.asset_maintenance.createMany({
        data: tickets.map(({ issueKey, triggerInspection, completionInspection, ...row }, i) => ({
          maintenance_id: i + 1,
          ...row,
          issue_type_id: issueTypeId.get(issueKey)!,
          trigger_inspection_id: triggerInspection?.id ?? null,
          completion_inspection_id: completionInspection?.id ?? null,
        })),
      });
      const retirements = byTime(history.retirements, (r) => r.requested_at);
      await tx.asset_retirements.createMany({
        data: retirements.map(({ assessmentInspection, ...row }, i) => ({
          retirement_id: i + 1,
          ...row,
          assessment_inspection_id: assessmentInspection?.id ?? null,
        })),
      });

      const assetIdOf = new Map(SEEDED_ASSETS.map((a) => [a.tag, a.assetId]));
      await tx.asset_remarks.createMany({
        data: byTime(history.remarks, (r) => r.created_at).map(({ tag, ...row }, i) => ({ remark_id: i + 1, asset_id: assetIdOf.get(tag)!, ...row })),
      });
      await tx.user_tickets.createMany({ data: history.userTickets });

      await tx.activity_log.createMany({ data: byTime(history.activity, (r) => r.created_at) });
    },
    { timeout: 120_000 },
  );
  return [...photos.values()].filter((p) => p !== null).length;
}

/**
 * Checks both variables before connecting, then the database, then writes. Prints the target as host:port/name only.
 *
 * @throws SeedRefused when a variable or the database fails a check (nothing is written)
 */
async function main(): Promise<void> {
  const target = parseSeedTarget(process.env.SEED_DATABASE_URL);
  const password = readSeedPassword(process.env.SEED_PASSWORD);
  const photosDir = readSeedPhotosDir(process.env.SEED_PHOTOS_DIR);
  console.log(`[seed] Target: ${describeSeedTarget(target)}`);
  if (process.env.SEED_PHOTOS_DIR && !photosDir) console.log("[seed] SEED_PHOTOS_DIR is not a folder, so every asset gets its category picture.");

  const prisma = connect(target);
  let photoCount = 0;
  try {
    await checkDatabase(prisma, target);
    photoCount = await writeDemoData(prisma, password, photosDir);
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `[seed] Done: ${Object.values(roles_role_name).length} roles, ${DEMO_LABS.length} labs, ${DEMO_ACCOUNTS.length} demo accounts, ` +
      `${DEMO_PROJECTS.length} projects, ${DEMO_ASSETS.length} demo assets (${photoCount} with a photo from SEED_PHOTOS_DIR).`,
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
