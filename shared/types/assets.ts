/**
 * Request and response shapes of the asset registry endpoints.
 * Layer: shared. Imported by server/features/assets/ and web/api/assets.api.ts. Imports nothing.
 * Used by: every role's inventory view, the asset detail modal, Staff asset registration and editing.
 */

/** The body of POST /api/assets, as IntakeWizard sends it. */
export interface AssetCreateInput {
  name: string;
  /** Any spelling: the server upper-cases it, turns spaces and dashes into underscores, and stores DEV_KIT if it is not a category. */
  category: string;
  serial?: string;
  manufacturer?: string;
  /** The picture, under any of three names: a data URL or a link to a .jpg, .jpeg, .png, .webp, or .svg file. */
  image?: string;
  image_url?: string;
  imageUrl?: string;
  /** yyyy-mm-dd. */
  procured?: string;
  /** yyyy-mm-dd. */
  warranty?: string;
  /** "Unspecified" when not sent. */
  funding?: string;
  acquisitionValue?: number | string;
  /** The campus; stored with the lab as "<campus> — <lab>". */
  location?: string;
  /** The lab code. Also the tag prefix: the new asset gets "<lab>-<next number>". Required: there is no default lab. */
  lab?: string;
  /** users.user_id of the first custodian; user 1 when not sent. */
  custodianId?: number;
  /** The first record's remarks, under any of four names (the first one sent wins). */
  remarks?: string;
  description?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
}

/**
 * The body of PUT /api/assets/:assetTag, as EditAssetDialog sends it (only the fields Staff changed). Every field is
 * optional: an assets field is written only when sent. A change of status, location, custodian, condition, or remarks
 * adds a record; no record is changed (issue #74). A condition, or remarks under any name but `description`, also files
 * an inspection report.
 */
export interface AssetUpdateInput {
  name?: string;
  serial?: string;
  manufacturer?: string;
  category?: string;
  /** null or "" removes the picture. */
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  procured?: string;
  warranty?: string;
  /** "Unspecified" when sent empty. Left as it is when not sent. */
  funding?: string;
  /** Left as it is when not sent. */
  acquisitionValue?: number | string;
  location?: string;
  lab?: string;
  /** The new custodian's user id, which must be a Custodian account; null for None (nobody holds it). (issue #95) */
  custodianId?: number | null;
  /** Display text such as "On Loan"; stored upper-cased with the first space as an underscore. */
  status?: string;
  /** An ASSET_CONDITIONS value; anything else keeps the record's condition. */
  assetCondition?: string;
  /** The inspection report's condition, by stored or display name; PERFECT for a name it does not know. */
  reportCondition?: string;
  remarks?: string;
  description?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
}

/** One inspection report inside an asset of GET /api/assets. */
export interface AssetListReport {
  id: number;
  reportId: string;
  assetId: string;
  /** Left out for a Custodian when someone else reported it. (D2) */
  reportedBy?: string;
  /** The inspection type's label, for example "Routine". */
  reporterRole: string;
  reportDate: string;
  date_logged: string;
  created_at: string;
  condition: string;
  remarks: string;
  image?: string;
  status: string;
}

/** The disposal details of a retired asset in GET /api/assets. */
export interface AssetDisposalDetails {
  /** Read from the packed reason text (M-13); left out for a Custodian (D2); "No Custodian" when the text names none. */
  lastCustodian?: string;
  breakdownReasons: string;
  disposalPathway: string;
  decommissionDate: string;
  /** Left out for a Custodian when it is someone else. (D2) */
  decommissionedBy?: string;
}

/** A person as an asset answer names them. A Researcher gets `{ hidden: true }` for anyone but themself. (D2) */
export type PersonRef = { userId: number; name: string } | { hidden: true };

/** A lab as an asset answer names it. */
export interface AssetLabRef {
  centerId: number;
  code: string;
  name: string;
  campus: "MANILA" | "LAGUNA" | "MCKINLEY";
  campusLabel: string;
}

/**
 * One asset of GET /api/assets. The contract fields (docs/contracts/lifecycle.md, section 1 and the `Asset` object)
 * are worked out on the server; the older fields after them stay while the screens move over.
 */
export interface AssetListItem {
  assetId: number;
  tag: string;
  name: string;
  serialNumber: string | null;
  manufacturer: string | null;
  category: string;
  categoryLabel: string;
  /** One of the six asset statuses, for example "ON_LOAN". */
  status: string;
  statusLabel: string;
  homeLab: AssetLabRef;
  homeRoom: string | null;
  /** "<lab short code>, <room>", "<lab short code>", or "TSG Office"; null when Missing or Retired. */
  currentLocation: string | null;
  /** Null when nobody holds the asset. */
  holder: PersonRef | null;
  /** The newest TSG inspection's condition, or null when TSG never inspected it. */
  condition: string | null;
  conditionLabel: string | null;
  healthScore: number | null;
  isOverdue: boolean;
  /** The loan in Pending Approval, Pending Release, On Loan, or Return Requested, if any. returnBy is yyyy-mm-dd. */
  openLoan: { loanId: number; status: string; returnBy: string } | null;
  project: { projectId: number; code: string; name: string } | null;
  fundingSource: { fundingSourceId: number; name: string } | null;
  acquisitionValue: number | null;
  /** yyyy-mm-dd, or null. */
  procurementDate: string | null;
  warrantyExpiry: string | null;
  accessories: string | null;
  itsPropertyTag: string | null;
  tsgTag: string | null;
  imageUrl: string | null;

  /** The asset tag (older field). */
  id: string;
  serial: string;
  /** The funding source's name, or "Unspecified". */
  funding: string;
  /** The acquisition value, or 0. */
  cost: number;
  procured: string;
  warranty: string;
  /** The home lab's campus label (older field). */
  location: string;
  /** The home lab's short code (older field). */
  lab: string;
  /** The condition, as `condition` (older field). */
  assetCondition?: string;
  /** The holder's full name. Left out when nobody holds the asset, and when it is hidden. */
  custodian?: string;
  /** The holder's user id, sent and left out exactly as `custodian` is. Screens match people by it. (issue #32) */
  custodianId?: number;
  /** True when someone holds the asset but the caller, a Custodian, may not see who (D2). Left out otherwise. */
  custodianHidden?: true;
  borrowedOn?: string;
  dueDate?: string;
  daysLeft?: number;
  disposalId?: string;
  disposalDetails?: AssetDisposalDetails;
  image: string | null;
  image_url: string | null;
  /** The newest TSG inspection's remarks, or a fixed sentence. */
  description: string;
  remarks?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
  asset_reports: AssetListReport[];
  asset_monetary: { acquisition_value: number; funding_source: string };
}

/** The filters GET /api/assets reads from its query string. Each is optional. */
export interface AssetListFilters {
  /** Part of the tag, serial number, or name, in any letter case. */
  q?: string;
  status?: string;
  centerId?: number;
}

/** One entry of GET /api/assets/:assetTag/history. */
export interface AssetHistoryEvent {
  /** ISO date-time. */
  at: string;
  /** What happened, for example "LOAN_REQUESTED", "INSPECTION", or an activity event type such as "ASSET_EDITED". */
  kind: string;
  label: string;
  /** Who did it; null when nobody is recorded. */
  actor: PersonRef | null;
  details: string | null;
  loanId?: number;
  maintenanceId?: number;
  retirementId?: number;
  inspectionId?: number;
}

/** The answer of GET /api/assets/:assetTag/history, without `success`. */
export interface AssetHistory {
  assetTag: string;
  assetName: string;
  /** Oldest first. */
  events: AssetHistoryEvent[];
}
