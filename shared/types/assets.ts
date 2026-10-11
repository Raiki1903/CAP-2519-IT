/** The body of POST /api/assets. */
export interface AssetCreateInput {
  name: string;
  category: string;
  serial?: string;
  manufacturer?: string;
  image?: string;
  image_url?: string;
  imageUrl?: string;
  procured?: string;
  warranty?: string;
  funding?: string;
  acquisitionValue?: number | string;
  location?: string;
  lab?: string;
  custodianId?: number;
  remarks?: string;
  description?: string;
  tsgRemarks?: string;
  itsRemarks?: string;
}

/** The body of PUT /api/assets/:assetTag. Every field is optional. */
export interface AssetUpdateInput {
  name?: string;
  serial?: string;
  manufacturer?: string;
  category?: string;
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  procured?: string;
  warranty?: string;
  funding?: string;
  acquisitionValue?: number | string;
  location?: string;
  lab?: string;
  custodian?: string;
  status?: string;
  assetCondition?: string;
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

/** One asset of GET /api/assets. */
export interface AssetListItem {
  id: string;
  name: string;
  serial: string;
  manufacturer: string;
  category: string;
  funding: string;
  cost: number;
  procured: string;
  warranty: string;
  location: string;
  lab: string;
  currentLocation?: string;
  status: string;
  condition: number;
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

/** One entry of GET /api/assets/:assetTag/custodian-history. */
export interface CustodianHistoryEntry {
  sequence: number;
  recordId?: number;
  custodianName: string;
  custodianEmail: string;
  custodianId?: number | string;
  status: string;
  location: string;
  currentLocation?: string;
  condition: string;
  remarks: string;
  dateLogged: string;
  isCurrent: boolean;
}

/** The answer of GET /api/assets/:assetTag/custodian-history, without `success`. */
export interface CustodianHistory {
  assetTag: string;
  assetName: string;
  historyCount: number;
  custodianHistory: CustodianHistoryEntry[];
}
