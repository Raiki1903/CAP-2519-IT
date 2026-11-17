/**
 * Imports repository: database reads, reference preloading, row locking, and atomic bulk transactions.
 * Layer: repository. Called by server/features/imports/imports.service.ts.
 * Calls: config/prisma.ts, shared/services/rowLocks.ts, and shared/services/activityLog.ts.
 * Used by: bulk CSV import of projects and assets.
 */
import {
  Prisma,
  type asset_condition,
  asset_inspections_type,
} from '@prisma/client';
import type { AssetCategory } from '@shared/enums/assetCategory';
import { prisma } from '../../config/prisma';
import { lockCenter } from '../../shared/services/rowLocks';
import { logActivity } from '../../shared/services/activityLog';

/** Preloaded lookup caches for validating project and asset references. */
export interface ImportLookupCache {
  centersByCode: Map<string, { centerId: number; shortCode: string }>;
  fundingByName: Map<string, { fundingSourceId: number; name: string }>;
  projectsByCode: Map<string, { projectId: number; projectCode: string }>;
  /** The codes of the active asset categories. */
  activeCategoryCodes: Set<string>;
}

/** Preloaded existing asset identifiers for duplicate detection. */
export interface AssetIdentifierCache {
  serials: Map<string, string>;
  itsTags: Map<string, string>;
  tsgTags: Map<string, string>;
}

/** Preloads lookup tables for research centers, funding sources, projects, and the active asset categories. */
export async function getLookupCache(tx?: Prisma.TransactionClient): Promise<ImportLookupCache> {
  const client = tx ?? prisma;
  const [centers, funding, projectRows, categories] = await Promise.all([
    client.research_centers.findMany({ select: { center_id: true, short_code: true } }),
    client.funding_sources.findMany({ select: { funding_source_id: true, name: true } }),
    client.projects.findMany({ select: { project_id: true, project_code: true } }),
    client.asset_categories.findMany({ where: { is_active: true }, select: { code: true } }),
  ]);

  const centersByCode = new Map<string, { centerId: number; shortCode: string }>();
  for (const c of centers) {
    centersByCode.set(c.short_code.toLowerCase(), { centerId: c.center_id, shortCode: c.short_code });
  }

  const fundingByName = new Map<string, { fundingSourceId: number; name: string }>();
  for (const f of funding) {
    fundingByName.set(f.name.toLowerCase(), { fundingSourceId: f.funding_source_id, name: f.name });
  }

  const projectsByCode = new Map<string, { projectId: number; projectCode: string }>();
  for (const p of projectRows) {
    projectsByCode.set(p.project_code.toLowerCase(), { projectId: p.project_id, projectCode: p.project_code });
  }

  const activeCategoryCodes = new Set(categories.map((c) => c.code));

  return { centersByCode, fundingByName, projectsByCode, activeCategoryCodes };
}

/** Preloads existing asset serial numbers, ITS property tags, and TSG tags across all assets. */
export async function getAssetIdentifierCache(tx?: Prisma.TransactionClient): Promise<AssetIdentifierCache> {
  const client = tx ?? prisma;
  const assets = await client.assets.findMany({
    select: {
      asset_tag: true,
      serial_number: true,
      its_property_tag: true,
      tsg_tag: true,
    },
  });

  const serials = new Map<string, string>();
  const itsTags = new Map<string, string>();
  const tsgTags = new Map<string, string>();

  for (const a of assets) {
    if (a.serial_number) {
      serials.set(a.serial_number.trim().toLowerCase(), a.asset_tag);
    }
    if (a.its_property_tag) {
      itsTags.set(a.its_property_tag.trim().toLowerCase(), a.asset_tag);
    }
    if (a.tsg_tag) {
      tsgTags.set(a.tsg_tag.trim().toLowerCase(), a.asset_tag);
    }
  }

  return { serials, itsTags, tsgTags };
}

/** Returns all existing project codes in lowercase. */
export async function getExistingProjectCodes(tx?: Prisma.TransactionClient): Promise<Set<string>> {
  const client = tx ?? prisma;
  const rows = await client.projects.findMany({ select: { project_code: true } });
  const codes = new Set<string>();
  for (const r of rows) {
    codes.add(r.project_code.trim().toLowerCase());
  }
  return codes;
}

/** Returns existing asset tags starting with the lab prefix. */
export async function getExistingTagsForPrefix(
  shortCode: string,
  tx?: Prisma.TransactionClient,
): Promise<string[]> {
  const client = tx ?? prisma;
  const rows = await client.assets.findMany({
    where: { asset_tag: { startsWith: `${shortCode}-` } },
    select: { asset_tag: true },
  });
  return rows.map((r) => r.asset_tag);
}

/** Executes an atomic operation inside a Prisma interactive transaction with a 60-second timeout. */
export async function runInTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(callback, { timeout: 60000 });
}

/** Data shape for creating a project during import. */
export interface CreateProjectImportRecord {
  row: number;
  projectCode: string;
  projectName: string;
  projectLeader: string;
  centerId: number;
  fundingSourceId: number | null;
  startDate: Date;
  endDate: Date | null;
}

/** Saves projects and records activity log entries within an active transaction. */
export async function saveProjectsTransaction(
  tx: Prisma.TransactionClient,
  projects: CreateProjectImportRecord[],
  actorId: number,
): Promise<{ row: number; key: string }[]> {
  const centerIds = Array.from(new Set(projects.map((p) => p.centerId))).sort((a, b) => a - b);
  for (const cid of centerIds) {
    await lockCenter(tx, cid);
  }

  const created: { row: number; key: string }[] = [];
  for (const item of projects) {
    await tx.projects.create({
      data: {
        project_code: item.projectCode,
        project_name: item.projectName,
        project_leader: item.projectLeader,
        center_id: item.centerId,
        funding_source_id: item.fundingSourceId,
        start_date: item.startDate,
        end_date: item.endDate,
      },
    });

    await logActivity(tx, {
      eventType: 'PROJECT_CREATED',
      actorId,
      details: `${item.projectCode} (import)`,
    });

    created.push({ row: item.row, key: item.projectCode });
  }

  return created;
}

/** Data shape for creating an asset during import. */
export interface CreateAssetImportRecord {
  row: number;
  centerId: number;
  labShortCode: string;
  name: string;
  category: AssetCategory;
  condition: asset_condition;
  healthScore: number | null;
  serialNumber: string | null;
  manufacturer: string | null;
  homeRoom: string | null;
  projectId: number | null;
  fundingSourceId: number | null;
  acquisitionValue: string | null;
  procurementDate: Date | null;
  warrantyExpiry: Date | null;
  accessories: string | null;
  itsPropertyTag: string | null;
  tsgTag: string | null;
  missingAccessories: string | null;
  inspectionRemarks: string | null;
}

/**
 * Saves assets, initial inspections, and activity log entries within an active transaction.
 * Sequential tags are generated per lab in file order.
 */
export async function saveAssetsTransaction(
  tx: Prisma.TransactionClient,
  assets: CreateAssetImportRecord[],
  actorId: number,
  nextTagHelper: (prefix: string, existing: string[]) => string,
): Promise<{ row: number; key: string }[]> {
  const centerIds = Array.from(new Set(assets.map((a) => a.centerId))).sort((a, b) => a - b);
  for (const cid of centerIds) {
    await lockCenter(tx, cid);
  }

  const existingTagsMap = new Map<string, string[]>();
  for (const item of assets) {
    if (!existingTagsMap.has(item.labShortCode)) {
      const tags = await getExistingTagsForPrefix(item.labShortCode, tx);
      existingTagsMap.set(item.labShortCode, tags);
    }
  }

  const created: { row: number; key: string }[] = [];

  for (const item of assets) {
    const existingTags = existingTagsMap.get(item.labShortCode)!;
    const tag = nextTagHelper(item.labShortCode, existingTags);
    existingTags.push(tag);

    const asset = await tx.assets.create({
      data: {
        asset_tag: tag,
        name: item.name,
        category: item.category,
        center_id: item.centerId,
        serial_number: item.serialNumber,
        manufacturer: item.manufacturer,
        home_room: item.homeRoom,
        project_id: item.projectId,
        funding_source_id: item.fundingSourceId,
        acquisition_value: item.acquisitionValue ? new Prisma.Decimal(item.acquisitionValue) : null,
        procurement_date: item.procurementDate,
        warranty_expiry: item.warrantyExpiry,
        accessories: item.accessories,
        its_property_tag: item.itsPropertyTag,
        tsg_tag: item.tsgTag,
        status: 'AVAILABLE',
      },
    });

    await tx.asset_inspections.create({
      data: {
        asset_id: asset.asset_id,
        inspected_by_id: actorId,
        type: asset_inspections_type.INITIAL,
        condition: item.condition,
        health_score: item.healthScore,
        remarks: item.inspectionRemarks,
        missing_accessories: item.missingAccessories,
      },
    });

    await logActivity(tx, {
      eventType: 'ASSET_REGISTERED',
      actorId,
      assetId: asset.asset_id,
      details: `${tag} (import)`,
    });

    created.push({ row: item.row, key: tag });
  }

  return created;
}

