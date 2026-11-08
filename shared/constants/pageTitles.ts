/**
 * The page titles of each module, so the sidebar and the page header of a module use the same words.
 * Most are the manuscript's titles (Chapter 3); the loans title is shortened to "Asset Loans".
 * Layer: shared. Imported by web/ (page headers and navigation). Imports nothing.
 * Used by: every role's navigation.
 */

/** One title per module. */
export const PAGE_TITLES = {
  maintenance: "Repair and Maintenance",
  disposal: "Asset Retirement",
  loans: "Asset Loans",
  assetInformation: "Asset Information",
  reports: "Reports and Analytics",
  administration: "System Administration",
  activityLog: "Activity Log",
  tickets: "Tickets",
} as const;
