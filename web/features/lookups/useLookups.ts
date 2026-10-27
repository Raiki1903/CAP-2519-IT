/**
 * Lookup hooks: load the option lists the forms pick from.
 * Layer: feature component (data hook). Called by features/assets/EditAssetDialog.tsx.
 * Calls: api/lookups.api.ts.
 * Used by: Staff asset editing.
 */
import { useEffect, useState } from "react";
import type { CustodianOption } from "@shared/types/lookups";
import * as lookupsApi from "@web/api/lookups.api";

/**
 * Loads the Custodian accounts (GET /api/lookups/users) when the calling form opens.
 *
 * @returns `custodians` (empty until loaded, and when the load fails) and `failed`, true when the load failed
 */
export function useCustodianOptions() {
  const [custodians, setCustodians] = useState<CustodianOption[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    lookupsApi.getCustodianOptions()
      .then(data => {
        if (!current) return;
        if (data.success && Array.isArray(data.users)) setCustodians(data.users);
        else setFailed(true);
      })
      .catch(err => {
        console.error("❌ Failed to load the custodian list:", err);
        if (current) setFailed(true);
      });
    return () => { current = false; };
  }, []);

  return { custodians, failed };
}
