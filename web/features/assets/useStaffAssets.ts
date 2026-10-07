import { useState, useEffect } from "react";
import { useServerData } from "@web/state/serverData";
import * as assetsApi from "@web/api/assets.api";

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
