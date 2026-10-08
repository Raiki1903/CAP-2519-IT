/**
 * The fake people, lab, and assets every test file starts from. All of it is invented test data.
 * Layer: test setup. Called by seed.ts and imported by test files for ids, tags, emails, and passwords.
 * Used by: every API test file.
 */

/**
 * The separator the server writes between campus and lab in asset_records locations, and splits on
 * when it lists assets. It is an em dash with a space on each side; the data has to match it exactly.
 */
export const LOCATION_SEPARATOR = " — ";

/** The one research center. Its short code is also the asset tag prefix, which is how the server scopes labs today. */
export const LAB = {
  centerId: 1,
  name: "Test Research Lab",
  shortCode: "TEST",
  location: "MANILA",
  /** How asset_records.location and the asset list write the home lab. */
  homeLocation: `Manila${LOCATION_SEPARATOR}TEST`,
} as const;

/** Where the server says an asset under maintenance is (its TSG_OFFICE_LOCATION). */
export const TSG_OFFICE_LOCATION = `Manila${LOCATION_SEPARATOR}TSG Office`;

/** Role rows, one per database role name, in the order of the roles_role_name enum. */
export const ROLE_IDS = {
  ADMIN: 1,
  ADRIC_DIRECTOR: 2,
  ADRIC_SECRETARY: 3,
  TSG_STAFF: 4,
  ITS_STAFF: 5,
  LAB_HEAD: 6,
  CUSTODIAN: 7,
} as const;

export type RoleName = keyof typeof ROLE_IDS;

/** One seeded account. `fullName` is what the server prints, and what its name lookups match. */
export interface TestUser {
  userId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  password: string;
  idNumber: number;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  role: RoleName;
  /** Linked to LAB through user_centers when true. */
  inLab: boolean;
}

function user(userId: number, lastName: string, emailName: string, userType: TestUser["userType"], role: RoleName, inLab: boolean): TestUser {
  return {
    userId,
    firstName: "Test",
    lastName,
    fullName: `Test ${lastName}`,
    email: `${emailName}@example.test`,
    password: `test-password-${emailName}`,
    idNumber: 90000000 + userId,
    userType,
    role,
    inLab,
  };
}

/**
 * Seeded accounts. ADMIN must be user 1: the server uses user 1 (DEFAULT_CUSTODIAN_ID) as the
 * fallback custodian and checks it exists on startup.
 */
export const USERS = {
  admin: user(1, "Admin", "admin", "STAFF", "ADMIN", false),
  director: user(2, "Director", "director", "FACULTY", "ADRIC_DIRECTOR", false),
  staffTsg: user(3, "Staff TSG", "staff.tsg", "STAFF", "TSG_STAFF", false),
  staffIts: user(4, "Staff ITS", "staff.its", "STAFF", "ITS_STAFF", false),
  labHead: user(5, "Lab Head", "labhead", "FACULTY", "LAB_HEAD", true),
  custodianA: user(6, "Custodian A", "custodian.a", "STUDENT", "CUSTODIAN", true),
  custodianB: user(7, "Custodian B", "custodian.b", "STUDENT", "CUSTODIAN", true),
  secretary: user(8, "Secretary", "secretary", "STAFF", "ADRIC_SECRETARY", false),
} as const satisfies Record<string, TestUser>;

/** One seeded asset, with the state it is in after seeding. */
export interface TestAsset {
  assetId: number;
  tag: string;
  name: string;
  category: "DEV_KIT" | "MONITOR" | "CAMERA" | "ROUTER" | "TABLET" | "PROJECTOR";
  /** The latest asset_records status after seeding. */
  recordStatus: "ACTIVE" | "ON_LOAN" | "MAINTENANCE" | "DISPOSED";
  /** The status text GET /api/assets shows for it. */
  listStatus: "Active" | "On Loan" | "Maintenance" | "Disposed";
  acquisitionValue: number;
}

function asset(assetId: number, name: string, category: TestAsset["category"], recordStatus: TestAsset["recordStatus"], listStatus: TestAsset["listStatus"]): TestAsset {
  return {
    assetId,
    tag: `${LAB.shortCode}-${String(assetId).padStart(4, "0")}`,
    name,
    category,
    recordStatus,
    listStatus,
    acquisitionValue: assetId * 1000,
  };
}

/** Seeded assets, one per state the workflows care about. Comments say what else is attached. */
export const ASSETS = {
  /** In the pool with the Admin, nothing pending. Free to borrow. */
  available: asset(1, "Test Dev Kit Available", "DEV_KIT", "ACTIVE", "Active"),
  /** On loan to Custodian A through an approved loan due in 30 days. */
  onLoan: asset(2, "Test Monitor On Loan", "MONITOR", "ON_LOAN", "On Loan"),
  /** Under maintenance, with a repair ticket in "Inspection Phase" reported by Custodian A. */
  inRepair: asset(3, "Test Camera In Repair", "CAMERA", "MAINTENANCE", "Maintenance"),
  /** Disposed through an approved disposal requested by Staff TSG. */
  disposed: asset(4, "Test Router Disposed", "ROUTER", "DISPOSED", "Disposed"),
  /** Active, with a pending loan request from Custodian B. */
  pendingLoan: asset(5, "Test Tablet Pending Loan", "TABLET", "ACTIVE", "Active"),
  /** Held by Custodian A in OPERATIONAL condition, with one inspection report by Staff TSG. */
  inspected: asset(6, "Test Projector Inspected", "PROJECTOR", "ACTIVE", "Active"),
} as const satisfies Record<string, TestAsset>;

/** Ids of the seeded workflow rows, for tests that act on them. */
export const SEEDED_ROWS = {
  approvedLoanId: 1,
  pendingLoanId: 2,
  repairId: 1,
  disposalId: 1,
  reportId: 1,
} as const;

/** Funding source written on every seeded asset. */
export const FUNDING_SOURCE = "Test Grant";
