/**
 * Staff asset list: loads every asset when a Staff page opens.
 * Layer: feature component (data hook). Called by the pages in pages/staff/ that show assets
 * (Overview, Inventory, Inspections, Returns, QR Tags).
 * Calls: api/assets.api.ts listAssets(), state/serverData.tsx (the shared asset list).
 * Used by: Staff (ITS and TSG).
 */
import { useState, useEffect } from "react";
import { useServerData } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";

/**
 * Loads GET /api/assets once when the calling page mounts. Until that answer arrives, or if it
 * fails or comes back empty, it shows the shared list that serverData.tsx loaded at startup.
 *
 * @returns `displayedAssets` (the list to show), `fetchDbAssets()` to reload it after a change,
 *   and `loadingDbAssets` and `dbAssetsError`, which no page shows today
 */
// TODO(M-01): this is a second GET /api/assets on top of the one serverData.tsx already made, and that endpoint reads nine tables. Step 12 (assets).
export function useStaffAssets() {
  const { assets } = useServerData();
  const [dbAssets, setDbAssets] = useState<any[]>([]);
  const [loadingDbAssets, setLoadingDbAssets] = useState(false);
  const [dbAssetsError, setDbAssetsError] = useState<string | null>(null);

  const fetchDbAssets = async () => {
    setLoadingDbAssets(true);
    setDbAssetsError(null);
    try {
      const data = await assetsApi.listAssets();
      if (data.success) {
        setDbAssets(data.assets);
      } else {
        throw new Error(data.error || "Failed to fetch assets from server");
      }
    } catch (err: any) {
      console.error("❌ Failed to fetch database assets:", err);
      setDbAssetsError(err.message || "Could not load assets from DB.");
    } finally {
      setLoadingDbAssets(false);
    }
  };

  useEffect(() => {
    fetchDbAssets();
  }, []);

  const displayedAssets = dbAssets.length > 0 ? dbAssets : assets;

  return { displayedAssets, fetchDbAssets, loadingDbAssets, dbAssetsError };
}
