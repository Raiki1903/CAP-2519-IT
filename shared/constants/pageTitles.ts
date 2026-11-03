/**
 * The page titles the manuscript names (Chapter 3), so every screen of a module uses the same words.
 * Layer: shared. Imported by web/ (page headers and navigation). Imports nothing.
 * Used by: every role's navigation.
 */

/** One title per module of the manuscript. */
export const PAGE_TITLES = {
  maintenance: "Repair and Maintenance",
  disposal: "Asset Disposal",
  loans: "Asset Loaning and Return",
  assetInformation: "Asset Information",
  reports: "Reports and Analytics",
  administration: "System Administration",
} as const;
