/**
 * The list of research labs a user can pick as their affiliation.
 * Layer: shared. Imported by web/ (Register.tsx). Imports nothing.
 * Used by: the self-registration form.
 */

/** One entry in a lab dropdown. `id` is the value stored, `name` is the label shown. */
export interface LabOption {
  id: string;
  name: string;
}

/**
 * Every lab offered at registration, plus "DLSU AdRIC" and "No affiliation".
 * The full name doubles as the id, and it is what the form sends as `labAffiliation`.
 */
// TODO(M-03): hardcoded, and separate from both research_centers and the short lab
// codes in server/shared/utils/campus.ts and server/features/analytics/analytics.service.ts. Phase 3 serves it from GET /api/research-centers.
export const DLSU_LABS: LabOption[] = [
  { id: "Bioinformatics Lab", name: "Bioinformatics Lab" },
  { id: "Center for Automation Research (CAR)", name: "Center for Automation Research (CAR)" },
  { id: "Center for ICT for Development (CITE4D)", name: "Center for ICT for Development (CITE4D)" },
  { id: "Center for Language Technologies (CeLT)", name: "Center for Language Technologies (CeLT)" },
  { id: "Center for Human-Computer Innovations (CeHCI)", name: "Center for Human-Computer Innovations (CeHCI)" },
  { id: "Center for Networking and Information Security (CNIS)", name: "Center for Networking and Information Security (CNIS)" },
  { id: "Computational Imaging and Visual Innovations (CIVI)", name: "Computational Imaging and Visual Innovations (CIVI)" },
  { id: "Graphics, Animation, Multimedia and Entertainment Laboratory (GAME Lab)", name: "Graphics, Animation, Multimedia and Entertainment Laboratory (GAME Lab)" },
  { id: "Technology, Education, Entertainment, Empathy, Design (TE3D) House", name: "Technology, Education, Entertainment, Empathy, Design (TE3D) House" },
  { id: "DLSU AdRIC", name: "DLSU AdRIC" },
  { id: "No affiliation", name: "No affiliation" },
];

/** Campus an asset or lab belongs to. */
export type Campus = "Manila" | "Laguna";

/** Metadata for a specialized research laboratory. */
export interface ResearchLabInfo {
  id: string;
  name: string;
  campus: Campus;
}

/**
 * The 10 specialized research laboratories with their assigned campuses.
 * Single source of truth across Director and Staff screens: CAR is Laguna, Bio is Manila.
 */
export const RESEARCH_LABS: ResearchLabInfo[] = [
  { id: "CITe4D", name: "CITe4D - Manila", campus: "Manila" },
  { id: "CAR", name: "CAR - Laguna", campus: "Laguna" },
  { id: "CeHCI", name: "CeHCI - Manila", campus: "Manila" },
  { id: "CeLT", name: "CeLT - Laguna", campus: "Laguna" },
  { id: "CNIS", name: "CNIS - Manila", campus: "Manila" },
  { id: "GAME", name: "GAME - Manila", campus: "Manila" },
  { id: "Bio", name: "Bio - Manila", campus: "Manila" },
  { id: "CIVI", name: "CIVI - Laguna", campus: "Laguna" },
  { id: "TE3D", name: "TE3D - Laguna", campus: "Laguna" },
  { id: "HXIL", name: "HXIL - Laguna", campus: "Laguna" },
];

/** Short codes of labs on the Laguna campus. */
export const LAGUNA_LAB_CODES = new Set(["CAR", "CeLT", "CIVI", "TE3D", "HXIL", "MECH"]);

/** Short codes of labs on the Manila campus. */
export const MANILA_LAB_CODES = new Set(["CITe4D", "CeHCI", "CNIS", "GAME", "Bio"]);

/** One lab group in the inspection queue. */
export interface InspectionLabGroup {
  id: string;
  name: string;
  labs: string[];
  color: string;
}

/**
 * The 4 inspection groups spreading the 10 research centers.
 */
export const INSPECTION_LAB_GROUPS: InspectionLabGroup[] = [
  { id: "A", name: "Group A", labs: ["CITe4D", "CAR", "CNIS"], color: "text-blue-600" },
  { id: "B", name: "Group B", labs: ["CeHCI", "CeLT", "TE3D"], color: "text-violet-600" },
  { id: "C", name: "Group C", labs: ["GAME", "Bio"], color: "text-amber-600" },
  { id: "D", name: "Group D", labs: ["CIVI", "HXIL"], color: "text-emerald-600" },
];

/**
 * Names the campus of a lab code, for the campus half of current_location.
 * Any code not on the Laguna list counts as Manila, including codes that are not labs.
 *
 * @param lab a lab short code, for example "CeLT"
 * @returns "Laguna" or "Manila"
 */
export function campusForLab(lab: string): Campus {
  const normalized = (lab || "").trim();
  for (const code of LAGUNA_LAB_CODES) {
    if (normalized.toLowerCase() === code.toLowerCase()) {
      return "Laguna";
    }
  }
  return "Manila";
}

/**
 * Determines which campus an asset belongs to from its location, lab, or asset tag.
 * CAR is Laguna, Bio is Manila.
 *
 * @param asset an asset object with optional location, lab, and tag fields
 * @returns "Laguna" or "Manila"
 */
export function campusForAsset(asset: { location?: string; lab?: string; id?: string; asset_tag?: string }): Campus {
  const loc = (asset.location || "").toLowerCase();
  const lab = (asset.lab || "").toLowerCase();
  const tag = (asset.asset_tag || asset.id || "");

  if (loc.includes("laguna") || loc.includes("canlubang")) return "Laguna";
  if (loc.includes("manila") || loc.includes("taft")) return "Manila";

  const isLaguna = ["car", "celt", "civi", "te3d", "hxil", "mech"].some(l => lab === l || lab.includes(l)) ||
    ["CAR-", "CeLT-", "CIVI-", "TE3D-", "HXIL-", "MECH-"].some(p => tag.toUpperCase().startsWith(p.toUpperCase()));

  if (isLaguna) return "Laguna";
  return "Manila";
}

