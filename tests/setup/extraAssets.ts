/**
 * Adds one more fake asset in a chosen custody state, for a test that needs an asset no other test touches,
 * and removes such assets again.
 * Layer: test setup. Called by the loan, return, transfer, repair, inspection, disposal, analytics, and session user test files.
 * Calls Prisma; reads fixtures.ts.
 * Used by: the workflows where each request changes an asset's state or its newest record, and the analytics
 * tests, which count every asset and so put the database back after each test.
 */
import type { PrismaClient } from "@prisma/client";
import { FUNDING_SOURCE, LAB, LOOKUPS, USERS } from "./fixtures";

/** Older than any record a request writes, so the record added here is never taken as the newest by mistake. (M-09) */
const EXTRA_RECORD_DATE = new Date("2026-04-01T09:00:00Z");

/** What a test can choose about the extra asset. Everything else matches the seeded assets. */
export interface ExtraAssetOptions {
  /** A tag no seeded asset uses, for example "TEST-0101". */
  tag: string;
  /** The old record status; assets.status follows it (ACTIVE is AVAILABLE, DISPOSED is RETIRED) unless `assetStatus` is given. */
  status?: "ACTIVE" | "ON_LOAN" | "MAINTENANCE" | "DISPOSED";
  /** assets.status, for the two statuses no record status maps to (Pending Retirement, Missing). */
  assetStatus?: "AVAILABLE" | "ON_LOAN" | "MAINTENANCE" | "PENDING_RETIREMENT" | "RETIRED" | "MISSING";
  /**
   * Who holds it. With status ON_LOAN, this person gets a loan On Loan, due in 30 days (or `returnBy`), so they are the
   * holder. The old record names them either way.
   */
  custodianId?: number;
  /** The loan's return-by date, for an asset ON_LOAN. */
  returnBy?: Date;
  /** With a condition, Staff TSG files a Routine inspection with it, so it is the asset's condition now. */
  condition?: "PERFECT" | "OPERATIONAL" | "MINOR_DRIFT" | "DEGRADED" | "CRITICAL_DEFECT";
  /** The record's home location (asset_records.location). Defaults to the home lab TEST. */
  location?: string;
  /** Where the record says the asset is right now. Defaults to its home lab. */
  currentLocation?: string;
  homeRoom?: string;
  remarks?: string;
  /** The owning project (assets.project_id), also written on the record. */
  projectId?: number;
  warrantyExpiry?: Date;
  /** A funding_sources name from LOOKUPS. Defaults to FUNDING_SOURCE. */
  fundingSource?: string;
  acquisitionValue?: number;
  /** The home lab (assets.center_id). Defaults to LAB. */
  centerId?: number;
}

/** The ids a test needs to read the extra asset back. */
export interface ExtraAsset {
  assetId: number;
  tag: string;
  name: string;
  /** The loan On Loan of an asset ON_LOAN, else undefined. */
  loanId?: number;
}

const ASSET_STATUS_OF = { ACTIVE: "AVAILABLE", ON_LOAN: "ON_LOAN", MAINTENANCE: "MAINTENANCE", DISPOSED: "RETIRED" } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates an asset in the state asked for, the way the server stores it: assets.status, a loan for a holder, an
 * inspection for a condition. It also writes one asset_records row, which Edit Asset and transfers still read until
 * commit 9. Defaults: Available, never inspected, nobody holds it, at its home lab TEST, no project, no warranty,
 * value 500.
 *
 * @param db Prisma on the test database
 * @param options the tag and any state that differs from the defaults
 * @returns the new asset's id, tag, and name, and its loan for an asset ON_LOAN
 */
export async function addExtraAsset(db: PrismaClient, options: ExtraAssetOptions): Promise<ExtraAsset> {
  const name = `Test Extra Asset ${options.tag}`;
  const location = options.location ?? LAB.homeLocation;
  const recordStatus = options.status ?? "ACTIVE";
  const fundingName = options.fundingSource ?? FUNDING_SOURCE;
  const funding = LOOKUPS.fundingSources.find(f => f.name === fundingName);
  const asset = await db.assets.create({
    data: {
      asset_tag: options.tag,
      name,
      category: "DEV_KIT",
      status: options.assetStatus ?? ASSET_STATUS_OF[recordStatus],
      center_id: options.centerId ?? LAB.centerId,
      home_room: options.homeRoom ?? null,
      serial_number: `TEST-SN-${options.tag}`,
      warranty_expiry: options.warrantyExpiry ?? null,
      project_id: options.projectId ?? null,
      funding_source_id: funding ? funding.fundingSourceId : null,
      acquisition_value: options.acquisitionValue ?? 500,
    },
  });
  await db.asset_records.create({
    data: {
      asset_id: asset.asset_id,
      status: recordStatus,
      asset_condition: options.condition ?? "PERFECT",
      location,
      current_location: options.currentLocation ?? location,
      current_custodian: options.custodianId ?? USERS.admin.userId,
      Asset_Remarks: options.remarks ?? null,
      project_id: options.projectId ?? null,
      date_logged: EXTRA_RECORD_DATE,
    },
  });
  let loanId: number | undefined;
  if (recordStatus === "ON_LOAN" && options.custodianId !== undefined) {
    const loan = await db.asset_loans.create({
      data: {
        asset_id: asset.asset_id,
        borrower_id: options.custodianId,
        purpose: `Test purpose: loan of ${options.tag}`,
        requested_at: EXTRA_RECORD_DATE,
        return_by: options.returnBy ?? new Date(Date.now() + 30 * DAY_MS),
        status: "ON_LOAN",
        destination_center_id: options.centerId ?? LAB.centerId,
      },
    });
    loanId = loan.loan_id;
  }
  if (options.condition) {
    await db.asset_inspections.create({
      data: {
        asset_id: asset.asset_id,
        inspected_by_id: USERS.staffTsg.userId,
        type: "ROUTINE",
        condition: options.condition,
        remarks: options.remarks ?? null,
        inspected_at: EXTRA_RECORD_DATE,
      },
    });
  }
  return { assetId: asset.asset_id, tag: options.tag, name, loanId };
}

/**
 * Deletes assets and every row that points at them, children first. For tests that must leave the
 * database as the seed made it, because another test in the same file counts every asset.
 *
 * @param db Prisma on the test database
 * @param assetIds the assets to delete
 */
export async function removeExtraAssets(db: PrismaClient, assetIds: number[]): Promise<void> {
  const where = { asset_id: { in: assetIds } };
  await db.activity_log.deleteMany({ where });
  await db.asset_loans.deleteMany({ where });
  await db.asset_returns.deleteMany({ where });
  await db.asset_transfers.deleteMany({ where });
  await db.asset_maintenance.deleteMany({ where });
  await db.asset_retirements.deleteMany({ where });
  await db.asset_inspection_metrics.deleteMany({ where: { asset_inspections: { asset_id: { in: assetIds } } } });
  await db.asset_inspections.deleteMany({ where });
  await db.asset_records.deleteMany({ where });
  await db.asset_monetary.deleteMany({ where });
  await db.assets.deleteMany({ where });
}
