/**
 * Writes the fixtures into the emptied test database: lab, roles, accounts, assets, and their workflow rows.
 * Layer: test setup. Called by harness.ts before each test file. Calls Prisma and the server's password helper; reads fixtures.ts.
 * Used by: every API test file.
 */
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../server/shared/services/passwords";
import { ASSET_STATUS_OF_RECORD, ASSETS, FUNDING_SOURCE, LAB, LOOKUPS, ROLE_IDS, SEEDED_ROWS, TSG_OFFICE_LOCATION, USERS } from "./fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fixed past timestamps, a day or more apart, so "newest record" ordering never ties. (M-09) */
const AT = {
  intake: new Date("2026-01-05T09:00:00Z"),
  loanApproved: new Date("2026-02-01T09:00:00Z"),
  repairReported: new Date("2026-02-09T09:00:00Z"),
  intoMaintenance: new Date("2026-02-10T09:00:00Z"),
  reportFiled: new Date("2026-03-01T09:00:00Z"),
  pendingLoanFiled: new Date("2026-03-01T09:00:00Z"),
  disposalFiled: new Date("2026-03-09T09:00:00Z"),
  disposed: new Date("2026-03-10T09:00:00Z"),
};

/**
 * Seeds the fixtures. Expects an empty database whose id counters start at 1 (see resetDatabase).
 * Due dates are relative to today so the seeded loans never turn overdue as time passes.
 */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  const users = Object.values(USERS);
  const assets = Object.values(ASSETS);

  await prisma.research_centers.create({
    data: { center_id: LAB.centerId, name: LAB.name, short_code: LAB.shortCode, location: LAB.location },
  });

  await prisma.funding_sources.createMany({
    data: LOOKUPS.fundingSources.map((f) => ({ funding_source_id: f.fundingSourceId, name: f.name })),
  });
  await prisma.issue_types.createMany({
    data: LOOKUPS.issueTypes.map((t) => ({ issue_type_id: t.issueTypeId, key: t.key, name: t.name, suggested_action: t.suggestedAction })),
  });
  await prisma.metric_definitions.createMany({
    data: LOOKUPS.metrics.map((m) => ({ metric_id: m.metricId, metric_key: m.metricKey, name: m.name, unit: m.unit, higher_is_better: m.higherIsBetter })),
  });
  await prisma.category_metrics.createMany({
    data: LOOKUPS.categoryMetrics.map((c) => ({ category: c.category, metric_id: c.metricId })),
  });

  await prisma.roles.createMany({
    data: Object.entries(ROLE_IDS).map(([roleName, roleId]) => ({ role_id: roleId, role_name: roleName as keyof typeof ROLE_IDS })),
  });

  const passwordHashes = await Promise.all(users.map((u) => hashPassword(u.password)));
  await prisma.users.createMany({
    data: users.map((u, i) => ({
      user_id: u.userId,
      first_name: u.firstName,
      last_name: u.lastName,
      email: u.email,
      password: passwordHashes[i],
      id_number: u.idNumber,
      user_type: u.userType,
    })),
  });
  await prisma.user_roles.createMany({
    data: users.map((u) => ({ user_id: u.userId, role_id: ROLE_IDS[u.role] })),
  });
  await prisma.user_centers.createMany({
    data: users.filter((u) => u.inLab).map((u) => ({ user_id: u.userId, center_id: LAB.centerId })),
  });
  await prisma.research_centers.update({ where: { center_id: LAB.centerId }, data: { head_user_id: USERS.labHead.userId } });

  await prisma.assets.createMany({
    data: assets.map((a) => ({
      asset_id: a.assetId,
      asset_tag: a.tag,
      name: a.name,
      category: a.category,
      status: ASSET_STATUS_OF_RECORD[a.recordStatus],
      center_id: LAB.centerId,
      serial_number: `TEST-SN-${a.assetId}`,
      manufacturer: "Test Manufacturer",
      procurement_date: new Date("2025-06-01"),
      warranty_expiry: new Date("2027-06-01"),
      funding_source_id: LOOKUPS.fundingSources[0].fundingSourceId,
      acquisition_value: a.acquisitionValue,
    })),
  });
  await prisma.asset_monetary.createMany({
    data: assets.map((a) => ({ asset_id: a.assetId, funding_source: FUNDING_SOURCE, acquisition_value: a.acquisitionValue })),
  });

  const intakeRecord = (assetId: number, custodianId: number) => ({
    asset_id: assetId,
    status: "ACTIVE" as const,
    asset_condition: "PERFECT" as const,
    location: LAB.homeLocation,
    current_location: LAB.homeLocation,
    current_custodian: custodianId,
    date_logged: AT.intake,
  });

  // Inserted one at a time, oldest first, so record ids follow date order too.
  const records = [
    intakeRecord(ASSETS.available.assetId, USERS.admin.userId),
    intakeRecord(ASSETS.onLoan.assetId, USERS.admin.userId),
    intakeRecord(ASSETS.inRepair.assetId, USERS.custodianA.userId),
    intakeRecord(ASSETS.disposed.assetId, USERS.admin.userId),
    intakeRecord(ASSETS.pendingLoan.assetId, USERS.admin.userId),
    {
      ...intakeRecord(ASSETS.inspected.assetId, USERS.custodianA.userId),
      asset_condition: "OPERATIONAL" as const,
      Asset_Remarks: "Test inspection: minor scuffs on the casing",
    },
    {
      ...intakeRecord(ASSETS.onLoan.assetId, USERS.custodianA.userId),
      status: "ON_LOAN" as const,
      date_logged: AT.loanApproved,
    },
    {
      ...intakeRecord(ASSETS.inRepair.assetId, USERS.custodianA.userId),
      status: "MAINTENANCE" as const,
      current_location: TSG_OFFICE_LOCATION,
      date_logged: AT.intoMaintenance,
    },
    {
      ...intakeRecord(ASSETS.disposed.assetId, USERS.admin.userId),
      status: "DISPOSED" as const,
      current_location: null,
      retirement_id: SEEDED_ROWS.disposalId,
      Asset_Remarks: `Decommissioned via Disposal #DISP-${SEEDED_ROWS.disposalId}`,
      date_logged: AT.disposed,
    },
  ];
  for (const record of records) {
    await prisma.asset_records.create({ data: record });
  }

  await prisma.asset_loans.createMany({
    data: [
      {
        loan_id: SEEDED_ROWS.approvedLoanId,
        asset_id: ASSETS.onLoan.assetId,
        borrower_id: USERS.custodianA.userId,
        purpose: `Destination Lab: ${LAB.shortCode}\n\nTest purpose: approved loan`,
        requested_at: AT.loanApproved,
        return_by: new Date(Date.now() + 30 * DAY_MS),
        status: "ON_LOAN",
        destination_center_id: LAB.centerId,
        decided_by_id: USERS.labHead.userId,
        decided_at: AT.loanApproved,
      },
      {
        loan_id: SEEDED_ROWS.pendingLoanId,
        asset_id: ASSETS.pendingLoan.assetId,
        borrower_id: USERS.custodianB.userId,
        purpose: `Destination Lab: ${LAB.shortCode}\n\nTest purpose: pending loan`,
        requested_at: AT.pendingLoanFiled,
        return_by: new Date(Date.now() + 14 * DAY_MS),
        status: "PENDING_APPROVAL",
        destination_center_id: LAB.centerId,
      },
    ],
  });

  await prisma.asset_maintenance.create({
    data: {
      maintenance_id: SEEDED_ROWS.repairId,
      asset_id: ASSETS.inRepair.assetId,
      reported_by_id: USERS.custodianA.userId,
      issue_description: "Test repair: the lens does not focus",
      is_immediate: false,
      status: "INSPECTING",
      reported_at: AT.repairReported,
      received_by_id: USERS.staffTsg.userId,
      received_at: AT.intoMaintenance,
    },
  });

  await prisma.asset_retirements.create({
    data: {
      retirement_id: SEEDED_ROWS.disposalId,
      asset_id: ASSETS.disposed.assetId,
      requested_by_id: USERS.staffTsg.userId,
      reason: "Disposal Pathway: Test pathway\n\nBreakdown Justification:\nTest breakdown: the board is burnt",
      requested_at: AT.disposalFiled,
      status: "COMPLETED",
      previous_status: "AVAILABLE",
      decided_by_id: USERS.director.userId,
      decided_at: AT.disposed,
      completed_by_id: USERS.director.userId,
      completed_at: AT.disposed,
    },
  });

  await prisma.asset_inspections.create({
    data: {
      inspection_id: SEEDED_ROWS.reportId,
      asset_id: ASSETS.inspected.assetId,
      inspected_by_id: USERS.staffTsg.userId,
      type: "ROUTINE",
      condition: "OPERATIONAL",
      remarks: "Test inspection: minor scuffs on the casing",
      inspected_at: AT.reportFiled,
    },
  });
}
