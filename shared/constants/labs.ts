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
// codes in server/remainingRoutes.ts. Phase 3 serves it from GET /api/research-centers.
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
