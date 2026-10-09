// Which campus each research lab sits on — used to format current_location
// as "<Lab>-<Campus>" (e.g. "CITe4D-Manila"). Laguna set matches the same
// classification already used in /api/analytics/director; anything not
// listed defaults to Manila.
const LAGUNA_LABS = new Set(["CAR", "HXIL", "CeLT", "CIVI", "MECH"]);
export function campusForLab(lab: string): string {
    return LAGUNA_LABS.has(lab) ? "Laguna" : "Manila";
}
