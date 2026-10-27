/**
 * Lookup hooks: load the option lists the forms pick from.
 * Layer: feature component (data hook). Called by features/assets/EditAssetDialog.tsx and IntakeWizard.tsx.
 * Calls: api/lookups.api.ts.
 * Used by: Staff asset editing and registration.
 */
import { useEffect, useState } from "react";
import type { CustodianOption, FormLookups } from "@shared/types/lookups";
import * as lookupsApi from "@web/api/lookups.api";

// One load per page load, shared by every form that asks. A failed load is forgotten, so the next form tries again.
let formLookupsLoad: Promise<FormLookups | null> | null = null;

function loadFormLookups(): Promise<FormLookups | null> {
  if (!formLookupsLoad) {
    formLookupsLoad = lookupsApi.getFormLookups()
      .then(data => data.success
        ? { labs: data.labs, categories: data.categories, fundingSources: data.fundingSources, statuses: data.statuses }
        : null)
      .catch(err => {
        console.error("❌ Failed to load the form options:", err);
        return null;
      });
    formLookupsLoad.then(result => { if (!result) formLookupsLoad = null; });
  }
  return formLookupsLoad;
}

/**
 * Loads the form option lists (GET /api/lookups): labs, categories, funding sources, and editable statuses.
 *
 * @returns `lookups` (null until loaded, and when the load fails) and `failed`, true when the load failed
 */
export function useFormLookups() {
  const [lookups, setLookups] = useState<FormLookups | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    loadFormLookups().then(result => {
      if (!current) return;
      if (result) setLookups(result);
      else setFailed(true);
    });
    return () => { current = false; };
  }, []);

  return { lookups, failed };
}

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

/**
 * A list with one more value at the end when the list does not have it: a stored value from older data (for example
 * the funding "Unspecified"), so a form that opens on it still shows it and a save that does not touch it keeps it.
 *
 * @param options the list from the lookups, or [] while it loads or when it failed
 * @param current the value the form opened with
 * @returns the options, with `current` added when it is missing and not empty
 */
export function withCurrentOption(options: string[], current: string): string[] {
  return !current || options.includes(current) ? options : [...options, current];
}
