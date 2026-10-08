/**
 * Adds one more fake asset in a chosen custody state, for a test that needs an asset no other test touches.
 * Layer: test setup. Called by the loan, return, transfer, repair, inspection, and disposal test files. Calls Prisma; reads fixtures.ts.
 * Used by: the workflows where each request changes an asset's state or its newest record.
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
  /** Where the asset is right now. Defaults to its home lab. */
  currentLocation?: string;
  remarks?: string;
}

/** The ids a test needs to read the extra asset back. */
export interface ExtraAsset {
  assetId: number;
  tag: string;
  name: string;
}

/**
 * Creates an asset with its monetary row and one asset_records row, home lab TEST.
 * Defaults: ACTIVE, PERFECT, held by the Admin, at its home lab.
 *
 * @param db Prisma on the test database
 * @param options the tag and any state that differs from the defaults
 * @returns the new asset's id, tag, and name
 */
export async function addExtraAsset(db: PrismaClient, options: ExtraAssetOptions): Promise<ExtraAsset> {
  const name = `Test Extra Asset ${options.tag}`;
  const asset = await db.assets.create({
    data: { asset_tag: options.tag, name, category: "DEV_KIT", serial_number: `TEST-SN-${options.tag}` },
  });
  await db.asset_monetary.create({ data: { asset_id: asset.asset_id, funding_source: FUNDING_SOURCE, acquisition_value: 500 } });
  await db.asset_records.create({
    data: {
      asset_id: asset.asset_id,
      status: options.status ?? "ACTIVE",
      asset_condition: options.condition ?? "PERFECT",
      location: LAB.homeLocation,
      current_location: options.currentLocation ?? LAB.homeLocation,
      current_custodian: options.custodianId ?? USERS.admin.userId,
      Asset_Remarks: options.remarks ?? null,
      date_logged: EXTRA_RECORD_DATE,
    },
  });
  return { assetId: asset.asset_id, tag: options.tag, name };
}
