/**
 * Request and response shapes of the return endpoints.
 * Layer: shared. Imported by server/features/returns/ and web/api/returns.api.ts. Imports nothing.
 * Used by: Staff return finalization.
 */

/** The body of POST /api/assets/:assetTag/return, as ReturnForm sends it when Staff finalize a return. */
export interface ReturnInput {
  /** Not read: the returner is the asset's current custodian (issue #32). Older pages still send a name. */
  returnedBy?: string;
  /** One of ASSET_CONDITIONS from shared/enums/assetCondition.ts. The server refuses any other value. */
  condition: string;
  /** Inspection notes. Stored on the return and as the asset's new remarks. */
  comments?: string;
  /** Read when `comments` is empty. ReturnForm does not send it. */
  inspection?: string;
}

/** One row of GET /api/asset_returns. */
export interface ReturnListItem {
  /** Display id, "RET-<return_id>". */
  id: string;
  returnId: number;
  /** The asset's tag; "" if the asset is gone. */
  assetId: string;
  /** The asset's name. */
  asset: string;
  /** The returner's full name, or "Unknown". */
  returnedBy: string;
  /** The condition reported on the return. */
  condition: string | null;
  /** The "CLR-..." reference shown to Staff when the return was finalized. */
  referenceNumber: string;
  /** ISO timestamp. */
  returnedOn: string;
}
