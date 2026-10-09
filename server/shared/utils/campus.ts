/**
 * Which campus a research lab is on, from its short code.
 * Layer: shared (server utility). Called by features/loans/loans.service.ts and features/transfers/transfers.service.ts. Calls nothing.
 * Used by: Lab Head loan and transfer approval, which write the campus into the asset's current_location.
 */

// TODO(M-03): one more lab list, by short code, apart from shared/constants/labs.ts. Campus should come from research_centers.location. Phase 3, or step 12 (assets).
const LAGUNA_LABS = new Set(["CAR", "HXIL", "CeLT", "CIVI", "MECH"]);

/**
 * Names the campus of a lab code, for the campus half of current_location.
 * Any code not on the Laguna list counts as Manila, including codes that are not labs.
 *
 * @param lab a lab short code, for example "CeLT"
 * @returns "Laguna" or "Manila"
 */
export function campusForLab(lab: string): string {
    return LAGUNA_LABS.has(lab) ? "Laguna" : "Manila";
}
