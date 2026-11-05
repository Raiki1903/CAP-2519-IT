/**
 * Lookup hooks: load the option lists the forms pick from.
 * Layer: feature component (data hook). Called by features/assets/EditAssetDialog.tsx and IntakeWizard.tsx,
 * features/loans/LoanForm.tsx, and pages/auth/Register.tsx.
 * Calls: api/lookups.api.ts.
 * Used by: Staff asset editing and registration, the Custodian borrow request, reporting an issue, and the sign-up page.
 */
import { useEffect, useState } from "react";
import type { FormLookups } from "@shared/types/lookups";
import * as lookupsApi from "@web/api/lookups.api";

// One load per page load, shared by every form that asks. A failed load is forgotten, so the next form tries again.
let formLookupsLoad: Promise<FormLookups | null> | null = null;

function loadFormLookups(): Promise<FormLookups | null> {
  if (!formLookupsLoad) {
    formLookupsLoad = lookupsApi.getFormLookups()
      .then(data => data.success
        ? {
          labs: data.labs, categories: data.categories, fundingSources: data.fundingSources, issueTypes: data.issueTypes,
          metricsByCategory: data.metricsByCategory, projects: data.projects,
        }
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
 * Loads the form option lists (GET /api/lookups): labs, categories, funding sources, issue types, metrics, and projects.
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

/** The issue type that stands for "something else", for the screens that file a ticket with only a text. */
export const OTHER_ISSUE_TYPE_KEY = "OTHER";

/**
 * The id of the "Other" issue type, which a ticket filed from a text alone (the TSG flag in the asset modal, the
 * Researcher's immediate inspection) carries.
 *
 * @param lookups the loaded lists, or null while they load
 * @returns the issue type id, or null when the lookups are not loaded or have no such type
 */
export function otherIssueTypeId(lookups: FormLookups | null): number | null {
  return lookups?.issueTypes.find(t => t.key === OTHER_ISSUE_TYPE_KEY)?.issueTypeId ?? null;
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
