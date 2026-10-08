/**
 * Adds one more fake asset in a chosen custody state, for a test that needs an asset no other test touches,
 * and removes such assets again.
 * Layer: test setup. Called by the loan, return, transfer, repair, inspection, disposal, and analytics test files.
 * Calls Prisma; reads fixtures.ts.
 * Used by: the workflows where each request changes an asset's state or its newest record, and the analytics
 * tests, which count every asset and so put the database back after each test.
 */
import type { PrismaClient } from "@prisma/client";
import { FUNDING_SOURCE, LAB, USERS } from "./fixtures";

/** Older than any record a request writes, so the record added here is never taken as the newest by mistake. (M-09) */
const EXTRA_RECORD_DATE = new Date("2026-04-01T09:00:00Z");

/** What a test can choose about the extra asset. Everything else matches the seeded assets. */
export interface ExtraAssetOptions {
  /** A tag no seeded asset uses, for example "TEST-0101". The part before the dash is the lab the server reads. */
  tag: string;
  status?: "ACTIVE" | "ON_LOAN" | "MAINTENANCE" | "DISPOSED";
  custodianId?: number;
  condition?: "PERFECT" | "OPERATIONAL" | "MINOR_DRIFT" | "DEGRADED" | "CRITICAL_DEFECT";
  /** The record's home location (asset_records.location). Defaults to the home lab TEST. */
  location?: string;
  /** Where the asset is right now. Defaults to its home lab. */
  currentLocation?: string;
  remarks?: string;
  /** The project the record assigns the asset to (projects.master_id). */
  projectId?: number;
  warrantyExpiry?: Date;
  fundingSource?: string;
  acquisitionValue?: number;
}

/** The ids a test needs to read the extra asset back. */
export interface ExtraAsset {
  assetId: number;
  tag: string;
  name: string;
}

/**
 * Creates an asset with its monetary row and one asset_records row.
 * Defaults: ACTIVE, PERFECT, held by the Admin, at its home lab TEST, no project, no warranty, value 500.
 *
 * @param db Prisma on the test database
 * @param options the tag and any state that differs from the defaults
 * @returns the new asset's id, tag, and name
 */
export async function addExtraAsset(db: PrismaClient, options: ExtraAssetOptions): Promise<ExtraAsset> {
  const name = `Test Extra Asset ${options.tag}`;
  const location = options.location ?? LAB.homeLocation;
  const asset = await db.assets.create({
    data: {
      asset_tag: options.tag,
      name,
      category: "DEV_KIT",
      serial_number: `TEST-SN-${options.tag}`,
      warranty_expiry: options.warrantyExpiry ?? null,
    },
  });
  await db.asset_monetary.create({
    data: { asset_id: asset.asset_id, funding_source: options.fundingSource ?? FUNDING_SOURCE, acquisition_value: options.acquisitionValue ?? 500 },
  });
  await db.asset_records.create({
    data: {
      asset_id: asset.asset_id,
      status: options.status ?? "ACTIVE",
      asset_condition: options.condition ?? "PERFECT",
      location,
      current_location: options.currentLocation ?? location,
      current_custodian: options.custodianId ?? USERS.admin.userId,
      Asset_Remarks: options.remarks ?? null,
      project_id: options.projectId ?? null,
      date_logged: EXTRA_RECORD_DATE,
    },
  });
  return { assetId: asset.asset_id, tag: options.tag, name };
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
  await db.asset_loans.deleteMany({ where });
  await db.asset_returns.deleteMany({ where });
  await db.asset_transfers.deleteMany({ where });
  await db.asset_repairs.deleteMany({ where });
  await db.asset_reports.deleteMany({ where });
  await db.asset_disposals.deleteMany({ where });
  await db.asset_records.deleteMany({ where });
  await db.asset_monetary.deleteMany({ where });
  await db.assets.deleteMany({ where });
}
