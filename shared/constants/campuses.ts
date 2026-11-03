/**
 * The three campuses (research_centers.location) and their labels.
 * Layer: shared. Imported by the server (lookups, derive helpers, analytics) and web/. Imports nothing.
 * Used by: every screen that shows where a lab is. A lab's campus always comes from its research center, never from a list of labs.
 */

/** Every value of research_centers.location. Must match the `research_centers_location` enum in schema.prisma. */
export const CAMPUSES = ["MANILA", "LAGUNA", "MCKINLEY"] as const;

/** One value of research_centers.location. */
export type Campus = (typeof CAMPUSES)[number];

/** The label every screen shows for each campus. */
export const CAMPUS_LABELS: Record<Campus, string> = {
  MANILA: "Manila",
  LAGUNA: "Laguna",
  MCKINLEY: "McKinley",
};
