/**
 * The inspection lab groups (Group A to D) TSG works through, and the "Other" group for any lab not in one of them.
 * Layer: shared. Imported by web/ (the Inspection Queue). Imports nothing.
 * Used by: Staff inspections. A group is how TSG splits the rounds, not a campus: a lab's campus comes from its research center.
 */

/** One inspection group: the short codes of the labs whose assets are inspected together. */
export interface InspectionLabGroup {
  id: string;
  name: string;
  /** Lab short codes (research_centers.short_code). */
  labs: readonly string[];
}

/** The four groups, in the order the tabs show them. */
export const INSPECTION_LAB_GROUPS: readonly InspectionLabGroup[] = [
  { id: "A", name: "Group A", labs: ["CITe4D", "CAR", "CNIS"] },
  { id: "B", name: "Group B", labs: ["CeHCI", "CeLT", "TE3D"] },
  { id: "C", name: "Group C", labs: ["GAME", "Bio"] },
  { id: "D", name: "Group D", labs: ["CIVI", "HXIL"] },
];

/** The id of the group for labs that are in none of the four. */
export const OTHER_INSPECTION_GROUP_ID = "Other";

/**
 * Finds the group of a lab.
 *
 * @param labCode the lab's short code, in any letter case
 * @returns the id of the group that lists the lab, or OTHER_INSPECTION_GROUP_ID when none does
 */
export function inspectionGroupIdOf(labCode: string | undefined | null): string {
  const code = (labCode ?? "").trim().toLowerCase();
  const group = INSPECTION_LAB_GROUPS.find(g => g.labs.some(lab => lab.toLowerCase() === code));
  return group ? group.id : OTHER_INSPECTION_GROUP_ID;
}
