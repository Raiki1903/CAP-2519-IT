/**
 * Imports service: CSV checking, business validation, preview generation, and atomic saving.
 * Layer: service. Called by server/features/imports/imports.controller.ts.
 * Calls: server/features/imports/csv.ts, imports.repository.ts, server/shared/services/assetTags.ts.
 * Used by: bulk CSV import of projects and assets.
 */
import type { Prisma, asset_condition, assets_category } from '@prisma/client';
import { ASSET_CATEGORIES } from '@shared/enums/assetCategory';
import { ASSET_CONDITIONS, SUGGESTED_HEALTH_SCORE } from '@shared/enums/assetCondition';
import {
  ASSET_IMPORT_COLUMNS,
  ASSET_IMPORT_REQUIRED_COLUMNS,
  IMPORT_MAX_PREVIEW_ROWS,
  PROJECT_IMPORT_COLUMNS,
  PROJECT_IMPORT_REQUIRED_COLUMNS,
} from '@shared/constants/importColumns';
import type { SessionIdentity } from '@shared/types/auth';
import type {
  ImportCheckResult,
  ImportRowError,
  ImportSaveResult,
} from '@shared/types/imports';
import {
  capErrors,
  parseCsv,
  parseDate,
  parseMoney,
} from './csv';
import * as importsRepository from './imports.repository';
import { nextTagOf } from '../../shared/services/assetTags';

/**
 * Normalizes a category string to match the assets_category enum.
 *
 * @param raw typed category from CSV
 * @returns canonical assets_category enum value or null if invalid
 */
function resolveCategory(raw: string): assets_category | null {
  const normalized = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (ASSET_CATEGORIES.includes(normalized as assets_category)) {
    return normalized as assets_category;
  }
  return null;
}

/**
 * Normalizes a condition string to match the asset_condition enum.
 *
 * @param raw typed condition from CSV
 * @returns canonical asset_condition enum value or null if invalid
 */
function resolveCondition(raw: string): asset_condition | null {
  const normalized = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (ASSET_CONDITIONS.includes(normalized as asset_condition)) {
    return normalized as asset_condition;
  }
  return null;
}

/** Result of validating a projects CSV file internally. */
interface ValidatedProjectsBatch {
  checkResult: ImportCheckResult;
  records: importsRepository.CreateProjectImportRecord[];
}

/** Result of validating an assets CSV file internally. */
interface ValidatedAssetsBatch {
  checkResult: ImportCheckResult;
  records: importsRepository.CreateAssetImportRecord[];
}

/**
 * Validates a projects CSV text against business rules and reference lookups.
 *
 * @param csvText raw CSV string
 * @param tx optional transaction client for atomic save validation
 */
async function validateProjectsCsv(
  csvText: string,
  tx?: Prisma.TransactionClient,
): Promise<ValidatedProjectsBatch> {
  const doc = parseCsv(csvText, PROJECT_IMPORT_REQUIRED_COLUMNS, PROJECT_IMPORT_COLUMNS);
  const errors: ImportRowError[] = [...doc.fileErrors];

  if (doc.rows.length === 0) {
    return {
      checkResult: {
        success: false,
        rowCount: 0,
        errors: capErrors(errors),
        preview: [],
      },
      records: [],
    };
  }

  const [lookupCache, existingCodes] = await Promise.all([
    importsRepository.getLookupCache(tx),
    importsRepository.getExistingProjectCodes(tx),
  ]);

  const seenCodesInFile = new Map<string, number>();
  const records: importsRepository.CreateProjectImportRecord[] = [];
  const preview: Record<string, string | number | null>[] = [];

  for (const row of doc.rows) {
    const rowNum = row.rowNumber;
    const vals = row.values;

    const code = vals.project_code ?? '';
    const name = vals.project_name ?? '';
    const leader = vals.project_leader ?? '';
    const labCode = vals.lab ?? '';
    const fundingName = vals.funding_source ?? '';
    const startDateRaw = vals.start_date ?? '';
    const endDateRaw = vals.end_date ?? '';

    let hasRowError = false;

    if (!code) {
      errors.push({ row: rowNum, column: 'project_code', message: 'Project code is required.' });
      hasRowError = true;
    } else if (code.length > 255) {
      errors.push({ row: rowNum, column: 'project_code', message: 'Project code can be at most 255 characters.' });
      hasRowError = true;
    } else {
      const lowerCode = code.toLowerCase();
      if (seenCodesInFile.has(lowerCode)) {
        errors.push({
          row: rowNum,
          column: 'project_code',
          message: `Project code repeats row ${seenCodesInFile.get(lowerCode)}.`,
        });
        hasRowError = true;
      } else {
        seenCodesInFile.set(lowerCode, rowNum);
      }

      if (existingCodes.has(lowerCode)) {
        errors.push({
          row: rowNum,
          column: 'project_code',
          message: 'Project code already exists.',
        });
        hasRowError = true;
      }
    }

    if (!name) {
      errors.push({ row: rowNum, column: 'project_name', message: 'Project name is required.' });
      hasRowError = true;
    } else if (name.length > 255) {
      errors.push({ row: rowNum, column: 'project_name', message: 'Project name can be at most 255 characters.' });
      hasRowError = true;
    }

    if (!leader) {
      errors.push({ row: rowNum, column: 'project_leader', message: 'Project leader is required.' });
      hasRowError = true;
    } else if (leader.length > 255) {
      errors.push({ row: rowNum, column: 'project_leader', message: 'Project leader can be at most 255 characters.' });
      hasRowError = true;
    }

    let resolvedCenterId: number | null = null;
    if (!labCode) {
      errors.push({ row: rowNum, column: 'lab', message: 'Lab is required.' });
      hasRowError = true;
    } else {
      const center = lookupCache.centersByCode.get(labCode.toLowerCase());
      if (!center) {
        errors.push({ row: rowNum, column: 'lab', message: `Unknown lab: ${labCode}.` });
        hasRowError = true;
      } else {
        resolvedCenterId = center.centerId;
      }
    }

    let resolvedFundingId: number | null = null;
    if (fundingName) {
      const funding = lookupCache.fundingByName.get(fundingName.toLowerCase());
      if (!funding) {
        errors.push({
          row: rowNum,
          column: 'funding_source',
          message: `Unknown funding source: ${fundingName}.`,
        });
        hasRowError = true;
      } else {
        resolvedFundingId = funding.fundingSourceId;
      }
    }

    let parsedStart: string | null = null;
    if (!startDateRaw) {
      errors.push({ row: rowNum, column: 'start_date', message: 'Start date is required.' });
      hasRowError = true;
    } else {
      parsedStart = parseDate(startDateRaw);
      if (!parsedStart) {
        errors.push({
          row: rowNum,
          column: 'start_date',
          message: `Invalid start date: ${startDateRaw}.`,
        });
        hasRowError = true;
      }
    }

    let parsedEnd: string | null = null;
    if (endDateRaw) {
      parsedEnd = parseDate(endDateRaw);
      if (!parsedEnd) {
        errors.push({
          row: rowNum,
          column: 'end_date',
          message: `Invalid end date: ${endDateRaw}.`,
        });
        hasRowError = true;
      } else if (parsedStart && parsedEnd < parsedStart) {
        errors.push({
          row: rowNum,
          column: 'end_date',
          message: 'End date cannot be earlier than start date.',
        });
        hasRowError = true;
      }
    }

    if (preview.length < IMPORT_MAX_PREVIEW_ROWS) {
      preview.push({
        row: rowNum,
        project_code: code || null,
        project_name: name || null,
        project_leader: leader || null,
        lab: labCode || null,
        funding_source: fundingName || null,
        start_date: parsedStart ?? (startDateRaw || null),
        end_date: parsedEnd ?? (endDateRaw || null),
      });
    }

    if (!hasRowError && resolvedCenterId && parsedStart) {
      records.push({
        row: rowNum,
        projectCode: code,
        projectName: name,
        projectLeader: leader,
        centerId: resolvedCenterId,
        fundingSourceId: resolvedFundingId,
        startDate: new Date(parsedStart),
        endDate: parsedEnd ? new Date(parsedEnd) : null,
      });
    }
  }

  const success = errors.length === 0;
  return {
    checkResult: {
      success,
      rowCount: doc.rows.length,
      errors: capErrors(errors),
      preview,
    },
    records,
  };
}

/**
 * Validates an assets CSV text against business rules and reference lookups.
 *
 * @param csvText raw CSV string
 * @param tx optional transaction client for atomic save validation
 */
async function validateAssetsCsv(
  csvText: string,
  tx?: Prisma.TransactionClient,
): Promise<ValidatedAssetsBatch> {
  const doc = parseCsv(csvText, ASSET_IMPORT_REQUIRED_COLUMNS, ASSET_IMPORT_COLUMNS);
  const errors: ImportRowError[] = [...doc.fileErrors];

  if (doc.rows.length === 0) {
    return {
      checkResult: {
        success: false,
        rowCount: 0,
        errors: capErrors(errors),
        preview: [],
      },
      records: [],
    };
  }

  const [lookupCache, idCache] = await Promise.all([
    importsRepository.getLookupCache(tx),
    importsRepository.getAssetIdentifierCache(tx),
  ]);

  const seenSerialsInFile = new Map<string, number>();
  const seenItsInFile = new Map<string, number>();
  const seenTsgInFile = new Map<string, number>();

  const records: importsRepository.CreateAssetImportRecord[] = [];
  const preview: Record<string, string | number | null>[] = [];

  const previewTagsPerLab = new Map<string, string[]>();

  for (const row of doc.rows) {
    const rowNum = row.rowNumber;
    const vals = row.values;

    const labCode = vals.lab ?? '';
    const name = vals.name ?? '';
    const categoryRaw = vals.category ?? '';
    const conditionRaw = vals.condition ?? '';
    const healthScoreRaw = vals.health_score ?? '';
    const serial = vals.serial_number ?? '';
    const manufacturer = vals.manufacturer ?? '';
    const homeRoom = vals.home_room ?? '';
    const projectCode = vals.project_code ?? '';
    const fundingName = vals.funding_source ?? '';
    const acquisitionRaw = vals.acquisition_value ?? '';
    const procurementRaw = vals.procurement_date ?? '';
    const warrantyRaw = vals.warranty_expiry ?? '';
    const accessories = vals.accessories ?? '';
    const itsTag = vals.its_property_tag ?? '';
    const tsgTag = vals.tsg_tag ?? '';
    const missingAcc = vals.missing_accessories ?? '';
    const remarks = vals.inspection_remarks ?? '';

    let hasRowError = false;

    let resolvedCenter: { centerId: number; shortCode: string } | null = null;
    if (!labCode) {
      errors.push({ row: rowNum, column: 'lab', message: 'Lab is required.' });
      hasRowError = true;
    } else {
      const found = lookupCache.centersByCode.get(labCode.toLowerCase());
      if (!found) {
        errors.push({ row: rowNum, column: 'lab', message: `Unknown lab: ${labCode}.` });
        hasRowError = true;
      } else {
        resolvedCenter = found;
      }
    }

    if (!name) {
      errors.push({ row: rowNum, column: 'name', message: 'Asset name is required.' });
      hasRowError = true;
    } else if (name.length > 255) {
      errors.push({ row: rowNum, column: 'name', message: 'Asset name can be at most 255 characters.' });
      hasRowError = true;
    }

    let resolvedCategory: assets_category | null = null;
    if (!categoryRaw) {
      errors.push({ row: rowNum, column: 'category', message: 'Category is required.' });
      hasRowError = true;
    } else {
      resolvedCategory = resolveCategory(categoryRaw);
      if (!resolvedCategory) {
        errors.push({ row: rowNum, column: 'category', message: `Unknown category: ${categoryRaw}.` });
        hasRowError = true;
      }
    }

    let resolvedCondition: asset_condition | null = null;
    if (!conditionRaw) {
      errors.push({ row: rowNum, column: 'condition', message: 'Condition is required.' });
      hasRowError = true;
    } else {
      resolvedCondition = resolveCondition(conditionRaw);
      if (!resolvedCondition) {
        errors.push({ row: rowNum, column: 'condition', message: `Unknown condition: ${conditionRaw}.` });
        hasRowError = true;
      }
    }

    let resolvedHealthScore: number | null = null;
    if (healthScoreRaw) {
      const parsed = parseInt(healthScoreRaw, 10);
      if (isNaN(parsed) || !/^\d+$/.test(healthScoreRaw) || parsed < 0 || parsed > 100) {
        errors.push({
          row: rowNum,
          column: 'health_score',
          message: 'Health score must be a whole number between 0 and 100.',
        });
        hasRowError = true;
      } else {
        resolvedHealthScore = parsed;
      }
    } else if (resolvedCondition) {
      resolvedHealthScore = SUGGESTED_HEALTH_SCORE[resolvedCondition];
    }

    if (serial) {
      if (serial.length > 255) {
        errors.push({ row: rowNum, column: 'serial_number', message: 'Serial number can be at most 255 characters.' });
        hasRowError = true;
      } else {
        const lowerSerial = serial.toLowerCase();
        if (seenSerialsInFile.has(lowerSerial)) {
          errors.push({
            row: rowNum,
            column: 'serial_number',
            message: `Serial number repeats row ${seenSerialsInFile.get(lowerSerial)}.`,
          });
          hasRowError = true;
        } else {
          seenSerialsInFile.set(lowerSerial, rowNum);
        }

        const matchTag = idCache.serials.get(lowerSerial);
        if (matchTag) {
          errors.push({
            row: rowNum,
            column: 'serial_number',
            message: `Serial number already used by ${matchTag}.`,
          });
          hasRowError = true;
        }
      }
    }

    if (itsTag) {
      if (itsTag.length > 100) {
        errors.push({ row: rowNum, column: 'its_property_tag', message: 'ITS property tag can be at most 100 characters.' });
        hasRowError = true;
      } else {
        const lowerIts = itsTag.toLowerCase();
        if (seenItsInFile.has(lowerIts)) {
          errors.push({
            row: rowNum,
            column: 'its_property_tag',
            message: `ITS property tag repeats row ${seenItsInFile.get(lowerIts)}.`,
          });
          hasRowError = true;
        } else {
          seenItsInFile.set(lowerIts, rowNum);
        }

        const matchTag = idCache.itsTags.get(lowerIts);
        if (matchTag) {
          errors.push({
            row: rowNum,
            column: 'its_property_tag',
            message: `ITS property tag already used by ${matchTag}.`,
          });
          hasRowError = true;
        }
      }
    }

    if (tsgTag) {
      if (tsgTag.length > 100) {
        errors.push({ row: rowNum, column: 'tsg_tag', message: 'TSG tag can be at most 100 characters.' });
        hasRowError = true;
      } else {
        const lowerTsg = tsgTag.toLowerCase();
        if (seenTsgInFile.has(lowerTsg)) {
          errors.push({
            row: rowNum,
            column: 'tsg_tag',
            message: `TSG tag repeats row ${seenTsgInFile.get(lowerTsg)}.`,
          });
          hasRowError = true;
        } else {
          seenTsgInFile.set(lowerTsg, rowNum);
        }

        const matchTag = idCache.tsgTags.get(lowerTsg);
        if (matchTag) {
          errors.push({
            row: rowNum,
            column: 'tsg_tag',
            message: `TSG tag already used by ${matchTag}.`,
          });
          hasRowError = true;
        }
      }
    }

    if (manufacturer && manufacturer.length > 255) {
      errors.push({ row: rowNum, column: 'manufacturer', message: 'Manufacturer can be at most 255 characters.' });
      hasRowError = true;
    }

    if (homeRoom && homeRoom.length > 100) {
      errors.push({ row: rowNum, column: 'home_room', message: 'Home room can be at most 100 characters.' });
      hasRowError = true;
    }

    let resolvedProjectId: number | null = null;
    if (projectCode) {
      const prj = lookupCache.projectsByCode.get(projectCode.toLowerCase());
      if (!prj) {
        errors.push({ row: rowNum, column: 'project_code', message: `Unknown project code: ${projectCode}.` });
        hasRowError = true;
      } else {
        resolvedProjectId = prj.projectId;
      }
    }

    let resolvedFundingId: number | null = null;
    if (fundingName) {
      const f = lookupCache.fundingByName.get(fundingName.toLowerCase());
      if (!f) {
        errors.push({ row: rowNum, column: 'funding_source', message: `Unknown funding source: ${fundingName}.` });
        hasRowError = true;
      } else {
        resolvedFundingId = f.fundingSourceId;
      }
    }

    let resolvedAcquisition: string | null = null;
    if (acquisitionRaw) {
      resolvedAcquisition = parseMoney(acquisitionRaw);
      if (resolvedAcquisition === null) {
        errors.push({
          row: rowNum,
          column: 'acquisition_value',
          message: 'Acquisition value must be a non-negative amount up to 99,999,999.99.',
        });
        hasRowError = true;
      }
    }

    let parsedProcurement: string | null = null;
    if (procurementRaw) {
      parsedProcurement = parseDate(procurementRaw);
      if (!parsedProcurement) {
        errors.push({
          row: rowNum,
          column: 'procurement_date',
          message: `Invalid procurement date: ${procurementRaw}.`,
        });
        hasRowError = true;
      }
    }

    let parsedWarranty: string | null = null;
    if (warrantyRaw) {
      parsedWarranty = parseDate(warrantyRaw);
      if (!parsedWarranty) {
        errors.push({
          row: rowNum,
          column: 'warranty_expiry',
          message: `Invalid warranty expiry date: ${warrantyRaw}.`,
        });
        hasRowError = true;
      }
    }

    if (accessories && accessories.length > 500) {
      errors.push({ row: rowNum, column: 'accessories', message: 'Accessories can be at most 500 characters.' });
      hasRowError = true;
    }

    if (missingAcc && missingAcc.length > 255) {
      errors.push({ row: rowNum, column: 'missing_accessories', message: 'Missing accessories can be at most 255 characters.' });
      hasRowError = true;
    }

    if (remarks && remarks.length > 255) {
      errors.push({ row: rowNum, column: 'inspection_remarks', message: 'Inspection remarks can be at most 255 characters.' });
      hasRowError = true;
    }

    if (preview.length < IMPORT_MAX_PREVIEW_ROWS) {
      let expectedTag = '';
      if (resolvedCenter) {
        const labKey = resolvedCenter.shortCode;
        if (!previewTagsPerLab.has(labKey)) {
          const initialTags = await importsRepository.getExistingTagsForCenter(resolvedCenter.centerId, tx);
          previewTagsPerLab.set(labKey, [...initialTags]);
        }
        const labTags = previewTagsPerLab.get(labKey)!;
        expectedTag = nextTagOf(labKey, labTags);
        labTags.push(expectedTag);
      }

      preview.push({
        row: rowNum,
        expectedTag: expectedTag || null,
        lab: labCode || null,
        name: name || null,
        category: categoryRaw || null,
        condition: conditionRaw || null,
        health_score: resolvedHealthScore,
        serial_number: serial || null,
        manufacturer: manufacturer || null,
        home_room: homeRoom || null,
        project_code: projectCode || null,
        funding_source: fundingName || null,
        acquisition_value: resolvedAcquisition ? parseFloat(resolvedAcquisition) : null,
        procurement_date: parsedProcurement ?? (procurementRaw || null),
        warranty_expiry: parsedWarranty ?? (warrantyRaw || null),
        accessories: accessories || null,
        its_property_tag: itsTag || null,
        tsg_tag: tsgTag || null,
        missing_accessories: missingAcc || null,
        inspection_remarks: remarks || null,
      });
    }

    if (!hasRowError && resolvedCenter && resolvedCategory && resolvedCondition) {
      records.push({
        row: rowNum,
        centerId: resolvedCenter.centerId,
        labShortCode: resolvedCenter.shortCode,
        name,
        category: resolvedCategory,
        condition: resolvedCondition,
        healthScore: resolvedHealthScore,
        serialNumber: serial || null,
        manufacturer: manufacturer || null,
        homeRoom: homeRoom || null,
        projectId: resolvedProjectId,
        fundingSourceId: resolvedFundingId,
        acquisitionValue: resolvedAcquisition,
        procurementDate: parsedProcurement ? new Date(parsedProcurement) : null,
        warrantyExpiry: parsedWarranty ? new Date(parsedWarranty) : null,
        accessories: accessories || null,
        itsPropertyTag: itsTag || null,
        tsgTag: tsgTag || null,
        missingAccessories: missingAcc || null,
        inspectionRemarks: remarks || null,
      });
    }
  }

  const success = errors.length === 0;
  return {
    checkResult: {
      success,
      rowCount: doc.rows.length,
      errors: capErrors(errors),
      preview,
    },
    records,
  };
}

/**
 * Checks a projects CSV text and returns validation status and preview.
 *
 * @param csvText raw CSV text
 */
export async function checkProjects(csvText: string): Promise<ImportCheckResult> {
  const { checkResult } = await validateProjectsCsv(csvText);
  return checkResult;
}

/**
 * Atomically imports projects from CSV text. If any error is found, writes nothing and returns checkResult.
 *
 * @param csvText raw CSV text
 * @param sessionUser acting session identity
 */
export async function saveProjects(
  csvText: string,
  sessionUser: SessionIdentity,
): Promise<ImportSaveResult | ImportCheckResult> {
  return importsRepository.runInTransaction(async (tx) => {
    const { checkResult, records } = await validateProjectsCsv(csvText, tx);
    if (!checkResult.success || checkResult.errors.length > 0) {
      return checkResult;
    }
    const created = await importsRepository.saveProjectsTransaction(tx, records, sessionUser.userId);
    return {
      success: true,
      created,
    };
  });
}

/**
 * Checks an assets CSV text and returns validation status and preview.
 *
 * @param csvText raw CSV text
 */
export async function checkAssets(csvText: string): Promise<ImportCheckResult> {
  const { checkResult } = await validateAssetsCsv(csvText);
  return checkResult;
}

/**
 * Atomically imports assets from CSV text. If any error is found, writes nothing and returns checkResult.
 *
 * @param csvText raw CSV text
 * @param sessionUser acting session identity
 */
export async function saveAssets(
  csvText: string,
  sessionUser: SessionIdentity,
): Promise<ImportSaveResult | ImportCheckResult> {
  return importsRepository.runInTransaction(async (tx) => {
    const { checkResult, records } = await validateAssetsCsv(csvText, tx);
    if (!checkResult.success || checkResult.errors.length > 0) {
      return checkResult;
    }
    const created = await importsRepository.saveAssetsTransaction(tx, records, sessionUser.userId, nextTagOf);
    return {
      success: true,
      created,
    };
  });
}

