/**
 * Reference list hook: loads one list of the Reference Data page and reloads it on request.
 * Layer: feature component (data hook). Called by CategoriesSection.tsx, LabsSection.tsx, and FundingSourcesSection.tsx.
 * Calls: the api function it is given (api/reference.api.ts).
 * Used by: the Reference Data page (TSG and the Secretary).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResult } from "@web/api/client";

/**
 * Loads a list when the section opens, and again when `reload` is called.
 *
 * @param load the api call, for example referenceApi.listCategories
 * @param field the answer's field that holds the list, for example "categories"
 * @returns `rows`, `loading`, `error` (the server's sentence, or null), and `reload`
 */
export function useReferenceList<T>(load: () => Promise<ApiResult>, field: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Counts the loads, so a slow answer to an older load never replaces a newer one.
  const loadCount = useRef(0);

  const reload = useCallback(async () => {
    const thisLoad = ++loadCount.current;
    setLoading(true);
    try {
      const data = await load();
      if (thisLoad !== loadCount.current) return;
      if (data.success && Array.isArray(data[field])) {
        setRows(data[field]);
        setError(null);
      } else {
        setError(data.error ?? "Could not load the list. Try again.");
      }
    } catch {
      if (thisLoad === loadCount.current) setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      if (thisLoad === loadCount.current) setLoading(false);
    }
  }, [load, field]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, error, reload };
}
