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
  /** The lab code. Also the tag prefix: the new asset gets "<lab>-<next number>". CITe4D when not sent. */
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
 * The body of PUT /api/assets/:assetTag, as EditAssetDialog sends it. Every field is optional: an assets field
 * is written only when sent. A condition or remarks also files an inspection report.
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
  funding?: string;
  /** Ignored when the monetary row exists: only the funding source is updated. (M-16, issue #74) */
  acquisitionValue?: number | string;
  location?: string;
  lab?: string;
  /** The custodian's display name. A name that matches no account leaves the custodian unchanged. (H-10, issue #32) */
  custodian?: string;
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

/** One history row inside an asset of GET /api/assets. */
export interface AssetListRecord {
  id: number;
  created_at: string;
  date_logged: string;
  status: string;
  condition: string;
  location: string;
  currentLocation?: string;
  custodian: string;
  remarks: string;
}

/** One transfer inside an asset of GET /api/assets. */
export interface AssetListTransfer {
  transfer_id: number;
  id: string;
  asset_id: number;
  assetId: string;
  from_custodian_id: number;
  to_custodian_id: number;
  from: string;
  to: string;
  requested_on: string;
  initiated: string;
  created_at: string;
  status: string;
  justification: string;
  lab: string;
}

/** One inspection report inside an asset of GET /api/assets. */
export interface AssetListReport {
  id: number;
  reportId: string;
  assetId: string;
  reportedBy: string;
  reporterRole: string;
  reportDate: string;
  date_logged: string;
  created_at: string;
  condition: string;
  remarks: string;
  image?: string;
  status: string;
}

/** The disposal details of a disposed asset in GET /api/assets. */
export interface AssetDisposalDetails {
  lastCustodian: string;
  breakdownReasons: string;
  disposalPathway: string;
  decommissionDate: string;
  decommissionedBy: string;
}

/** One asset of GET /api/assets: the asset with its current state, built from its newest record. */
export interface AssetListItem {
  /** The asset tag. */
  id: string;
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  funding: string;
  cost: number;
  procured: string;
  warranty: string;
  /** The home campus and lab, split from the newest record's location; Manila and CITe4D when it has none. */
  location: string;
  lab: string;
  /** Where the asset is right now ("<campus> — <lab>"), when a loan, transfer, or repair moved it. */
  currentLocation?: string;
  /** Active, On Loan, Maintenance, Disposed, or Overdue (on loan past the due date). */
  status: string;
  /** A health score from the condition: 100, 90, 78, 60, or 35. */
  condition: number;
  /** The newest record's condition, as stored. */
  assetCondition: string;
  custodian?: string;
  borrowedOn?: string;
  dueDate?: string;
  daysLeft?: number;
  disposalId?: string;
  disposalDetails?: AssetDisposalDetails;
  image: string | null;
  image_url: string | null;
  description: string;
  remarks?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
  asset_records: AssetListRecord[];
  asset_transfers: AssetListTransfer[];
  asset_reports: AssetListReport[];
  asset_monetary: { asset_monetary_id?: number; asset_id?: number; acquisition_value: number; funding_source: string };
}

/**
 * One entry of GET /api/assets/:assetTag/custodian-history: one asset record with its custodian.
 * An asset with no records gets one invented entry (sequence 1, "Equipment Custodian"). (H-09 family)
 */
export interface CustodianHistoryEntry {
  sequence: number;
  recordId?: number;
  custodianName: string;
  // TODO(C-02): the custodian's email and id number go to anyone who asks (01C 4.2). Step 13, then strip them (issue #72).
  custodianEmail: string;
  /** The custodian's id number (users.id_number), not users.user_id. */
  custodianId?: number | string;
  status: string;
  location: string;
  currentLocation?: string;
  condition: string;
  remarks: string;
  /** A display date and time. */
  dateLogged: string;
  /** True for the newest entry. */
  isCurrent: boolean;
}

/** The answer of GET /api/assets/:assetTag/custodian-history, without `success`. */
export interface CustodianHistory {
  assetTag: string;
  assetName: string;
  historyCount: number;
  custodianHistory: CustodianHistoryEntry[];
}
