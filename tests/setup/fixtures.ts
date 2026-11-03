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

/**
 * Role rows, one per database role name. Ids 5 and 6 were ITS_STAFF and LAB_HEAD, which the migrations removed:
 * a Lab Head is the account that heads a lab (LAB's head, the labHead account).
 */
export const ROLE_IDS = {
  IT_ADMIN: 1,
  ADRIC_DIRECTOR: 2,
  ADRIC_SECRETARY: 3,
  TSG_STAFF: 4,
  RESEARCHER: 7,
} as const;

export type RoleName = keyof typeof ROLE_IDS;

/** One seeded account. `fullName` is what the server prints, and what its name lookups match. */
export interface TestUser {
  userId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  /** The plain password, only for logging in. seed.ts stores its hash. */
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
 * Seeded accounts. IT_ADMIN must be user 1: the server records an asset nobody holds under user 1
 * (POOL_CUSTODIAN_ID, the placeholder custodian) and checks it exists on startup.
 */
export const USERS = {
  admin: user(1, "Admin", "admin", "STAFF", "IT_ADMIN", false),
  director: user(2, "Director", "director", "FACULTY", "ADRIC_DIRECTOR", false),
  staffTsg: user(3, "Staff TSG", "staff.tsg", "STAFF", "TSG_STAFF", false),
  staffIts: user(4, "Staff ITS", "staff.its", "STAFF", "TSG_STAFF", false),
  /** Heads LAB (research_centers.head_user_id), which gives it the Lab Head view. */
  labHead: user(5, "Lab Head", "labhead", "FACULTY", "RESEARCHER", true),
  custodianA: user(6, "Custodian A", "custodian.a", "STUDENT", "RESEARCHER", true),
  custodianB: user(7, "Custodian B", "custodian.b", "STUDENT", "RESEARCHER", true),
  secretary: user(8, "Secretary", "secretary", "STAFF", "ADRIC_SECRETARY", false),
} as const satisfies Record<string, TestUser>;

/** One seeded asset, with the state it is in after seeding. */
export interface TestAsset {
  assetId: number;
  tag: string;
  name: string;
  category: "DEV_KIT" | "MONITOR" | "CAMERA" | "ROUTER" | "TABLET" | "PROJECTOR";
  /** The latest asset_records status after seeding (Edit Asset and transfers still read the records until commit 9). */
  recordStatus: "ACTIVE" | "ON_LOAN" | "MAINTENANCE" | "DISPOSED";
  /** assets.status, which GET /api/assets sends as `status`. */
  listStatus: "AVAILABLE" | "ON_LOAN" | "MAINTENANCE" | "RETIRED";
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
  /** Available, nothing pending. Free to borrow. */
  available: asset(1, "Test Dev Kit Available", "DEV_KIT", "ACTIVE", "AVAILABLE"),
  /** On loan to Custodian A through a loan On Loan, due in 30 days. */
  onLoan: asset(2, "Test Monitor On Loan", "MONITOR", "ON_LOAN", "ON_LOAN"),
  /** In maintenance, with a ticket in Inspecting that Custodian A reported and Staff TSG received. */
  inRepair: asset(3, "Test Camera In Repair", "CAMERA", "MAINTENANCE", "MAINTENANCE"),
  /** Retired through a completed disposal requested by Staff TSG and decided by the Director. */
  disposed: asset(4, "Test Router Disposed", "ROUTER", "DISPOSED", "RETIRED"),
  /** Available, with a loan request in Pending Approval from Custodian B. */
  pendingLoan: asset(5, "Test Tablet Pending Loan", "TABLET", "ACTIVE", "AVAILABLE"),
  /** Available, OPERATIONAL from one Routine inspection by Staff TSG. Its old record names Custodian A, but no loan does. */
  inspected: asset(6, "Test Projector Inspected", "PROJECTOR", "ACTIVE", "AVAILABLE"),
} as const satisfies Record<string, TestAsset>;

/** The assets.status that goes with each asset_records status, as the foundation migration maps it. */
export const ASSET_STATUS_OF_RECORD = {
  ACTIVE: "AVAILABLE",
  ON_LOAN: "ON_LOAN",
  MAINTENANCE: "MAINTENANCE",
  DISPOSED: "RETIRED",
} as const;

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

/**
 * The lookup rows the seed writes. The reset empties every table, the migration's own lookup rows included, so the
 * tests bring theirs. The metric keys are the real ones, because the flag rules in shared/constants are keyed by them.
 */
export const LOOKUPS = {
  fundingSources: [
    { fundingSourceId: 1, name: FUNDING_SOURCE },
    { fundingSourceId: 2, name: "Test Second Fund" },
  ],
  issueTypes: [
    { issueTypeId: 1, key: "TEST_NO_POWER", name: "Test: will not power on", suggestedAction: "Test: check the power cable." },
    { issueTypeId: 2, key: "TEST_OTHER", name: "Test: other", suggestedAction: "Test: describe the problem." },
  ],
  metrics: [
    { metricId: 1, metricKey: "CPU_LOAD_TEMP", name: "CPU load temperature", unit: "°C", higherIsBetter: false },
    { metricId: 2, metricKey: "BAD_SECTORS", name: "Bad sectors", unit: "count", higherIsBetter: false },
    { metricId: 3, metricKey: "BATTERY_CAPACITY", name: "Battery capacity", unit: "% of design", higherIsBetter: true },
  ],
  /** Which metrics each category measures. Any other category has none. */
  categoryMetrics: [
    { category: "CPU", metricId: 1 },
    { category: "CPU", metricId: 2 },
    { category: "CPU", metricId: 3 },
    { category: "TABLET", metricId: 3 },
  ],
} as const;
