/**
 * Writes the fixtures into the emptied test database: lab, roles, accounts, assets, and their workflow rows.
 * Layer: test setup. Called by harness.ts before each test file. Calls Prisma; reads fixtures.ts.
 * Used by: every API test file.
 */
import type { PrismaClient } from "@prisma/client";
import { ASSETS, FUNDING_SOURCE, LAB, ROLE_IDS, SEEDED_ROWS, TSG_OFFICE_LOCATION, USERS } from "./fixtures";

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

  await prisma.roles.createMany({
    data: Object.entries(ROLE_IDS).map(([roleName, roleId]) => ({ role_id: roleId, role_name: roleName as keyof typeof ROLE_IDS })),
  });

  await prisma.users.createMany({
    data: users.map((u) => ({
      user_id: u.userId,
      first_name: u.firstName,
      last_name: u.lastName,
      email: u.email,
      password: u.password,
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

  await prisma.assets.createMany({
    data: assets.map((a) => ({
      asset_id: a.assetId,
      asset_tag: a.tag,
      name: a.name,
      category: a.category,
      serial_number: `TEST-SN-${a.assetId}`,
      manufacturer: "Test Manufacturer",
      procurement_date: new Date("2025-06-01"),
      warranty_expiry: new Date("2027-06-01"),
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
      disposal_id: SEEDED_ROWS.disposalId,
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
        loaned_on: AT.loanApproved,
        due_date: new Date(Date.now() + 30 * DAY_MS),
        status: "approved",
      },
      {
        loan_id: SEEDED_ROWS.pendingLoanId,
        asset_id: ASSETS.pendingLoan.assetId,
        borrower_id: USERS.custodianB.userId,
        purpose: `Destination Lab: ${LAB.shortCode}\n\nTest purpose: pending loan`,
        loaned_on: AT.pendingLoanFiled,
        due_date: new Date(Date.now() + 14 * DAY_MS),
        status: "pending",
      },
    ],
  });

  await prisma.asset_repairs.create({
    data: {
      repair_id: SEEDED_ROWS.repairId,
      asset_id: ASSETS.inRepair.assetId,
      reported_by_id: USERS.custodianA.userId,
      issue_description: "Test repair: the lens does not focus",
      is_immediate: false,
      progress_status: "Inspection Phase",
      created_at: AT.repairReported,
    },
  });

  await prisma.asset_disposals.create({
    data: {
      disposal_id: SEEDED_ROWS.disposalId,
      asset_id: ASSETS.disposed.assetId,
      disposed_by_id: USERS.staffTsg.userId,
      disposal_reason: "Disposal Pathway: Test pathway\n\nBreakdown Justification:\nTest breakdown: the board is burnt",
      disposal_date: AT.disposalFiled,
      status: "approved",
    },
  });

  await prisma.asset_reports.create({
    data: {
      report_id: SEEDED_ROWS.reportId,
      asset_id: ASSETS.inspected.assetId,
      reported_by_id: USERS.staffTsg.userId,
      report_condition: "OPERATIONAL",
      report_remarks: "Test inspection: minor scuffs on the casing",
      report_date: AT.reportFiled,
    },
  });
}
