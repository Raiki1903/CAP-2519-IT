/** What the return form sends when a return is finalized. */
export interface ReturnInput {
  /** Display name of the person returning the asset. */
  returnedBy?: string;
  /** One of ASSET_CONDITIONS from shared/enums/assetCondition.ts. */
  condition: string;
  /** Inspection notes. */
  comments?: string;
  inspection?: string;
}

export interface ReturnListItem {
  id: string;
  returnId: number;
  assetId: string;
  asset: string;
  returnedBy: string;
  condition: string | null;
  referenceNumber: string;
  returnedOn: string;
}
