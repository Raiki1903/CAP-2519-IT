// Rule-based reasoning engine for the Analytics module.
// Turns numeric fleet data (condition scores, repair logs, inspection history)
// into written diagnostic and prescriptive narratives. Deterministic — no network calls.
import type { Asset, RepairRequest, InspectionReport } from "../context";

export type Severity = "Nominal" | "Warning" | "Critical";
export type Confidence = "High" | "Medium" | "Low";
export type Urgency = "Routine" | "Scheduled" | "Urgent" | "Immediate";

export interface AssetDiagnosis {
  severity: Severity;
  confidence: Confidence;
  primaryFactor: string;
  narrative: string;
  contributingFactors: string[];
}

export interface AssetPrescription {
  urgency: Urgency;
  action: string;
  justification: string;
  expectedOutcome: string;
}

const STATUS_SCORE_MAP: Record<string, number> = {
  "Perfect": 100,
  "Operational": 90,
  "Minor Drift": 78,
  "Degraded Performance": 60,
  "Critical Failure": 35,
};

// Category → most likely failure mode, used when an asset has no repair history of its own to draw from.
function categoryFailureMode(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes("robot") || cat.includes("simulator")) return "mechanical joint / servo drift";
  if (cat.includes("cpu") || cat.includes("server")) return "storage array wear and thermal load";
  if (cat.includes("camera") || cat.includes("sensor")) return "calibration and optical drift";
  if (cat.includes("vr") || cat.includes("tablet")) return "battery capacity fade";
  if (cat.includes("switch") || cat.includes("network")) return "connectivity / firmware instability";
  return "general component wear";
}

// Which root-cause bucket an asset's own repair descriptions cluster into (mirrors the fleet-wide clustering logic).
function dominantRepairCause(repairs: RepairRequest[]): string | null {
  const buckets = { Battery: 0, Mechanical: 0, Thermal: 0, Storage: 0, Other: 0 };
  repairs.forEach(r => {
    const desc = r.description.toLowerCase();
    if (desc.includes("battery") || desc.includes("power")) buckets.Battery++;
    else if (desc.includes("joint") || desc.includes("drift") || desc.includes("calibration") || desc.includes("encoder")) buckets.Mechanical++;
    else if (desc.includes("thermal") || desc.includes("temperature") || desc.includes("cooling") || desc.includes("fan")) buckets.Thermal++;
    else if (desc.includes("storage") || desc.includes("ssd") || desc.includes("disk") || desc.includes("sector")) buckets.Storage++;
    else buckets.Other++;
  });
  const entries = Object.entries(buckets).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [label] = entries[0];
  const map: Record<string, string> = {
    Battery: "battery / power failures",
    Mechanical: "mechanical or calibration drift",
    Thermal: "thermal management issues",
    Storage: "storage sector integrity issues",
    Other: "unclassified component faults",
  };
  return map[label];
}

/**
 * Diagnoses a single asset: why its condition score is what it is, and how confident
 * that read is given the supporting evidence (repair logs + inspection history).
 */
export function diagnoseAsset(
  asset: Asset,
  peerAvg: number,
  assetRepairs: RepairRequest[],
  assetInspections: InspectionReport[] // must be sorted oldest → newest
): AssetDiagnosis {
  const severity: Severity = asset.condition >= 80 ? "Nominal" : asset.condition >= 50 ? "Warning" : "Critical";
  const deviation = peerAvg - asset.condition;
  const baseline = assetInspections.length > 0 ? (STATUS_SCORE_MAP[assetInspections[0].status] ?? 100) : 100;
  const decline = baseline - asset.condition;

  const evidencePoints = assetRepairs.length + assetInspections.length;
  const confidence: Confidence = evidencePoints >= 3 ? "High" : evidencePoints >= 1 ? "Medium" : "Low";

  const repairCause = dominantRepairCause(assetRepairs);
  const primaryFactor = repairCause ?? categoryFailureMode(asset.category);

  const contributingFactors: string[] = [];
  if (deviation > 10) contributingFactors.push(`${Math.round(deviation)} pts below the ${asset.category} peer average`);
  if (decline > 10) contributingFactors.push(`${Math.round(decline)} pt decline since baseline inspection`);
  if (assetRepairs.length > 0) contributingFactors.push(`${assetRepairs.length} logged repair ${assetRepairs.length === 1 ? "event" : "events"}`);
  if (evidencePoints === 0) contributingFactors.push("no inspection or repair history on file");

  let narrative: string;
  if (severity === "Nominal") {
    narrative = `${asset.name} is performing within nominal parameters at ${asset.condition}%, in line with (or above) the ${asset.category} peer average of ${peerAvg}%. No corrective action is indicated at this time.`;
  } else {
    const deviationClause = deviation > 5
      ? `${Math.round(deviation)} points below the ${asset.category} peer average of ${peerAvg}%`
      : `close to the ${asset.category} peer average of ${peerAvg}%, but still under threshold`;
    const declineClause = decline > 5
      ? ` The score has fallen ${Math.round(decline)} points from its recorded baseline of ${baseline}%,`
      : "";
    const evidenceClause = evidencePoints > 0
      ? `Evidence points to ${primaryFactor} as the primary factor${assetRepairs.length > 0 ? `, based on ${assetRepairs.length} logged repair ${assetRepairs.length === 1 ? "record" : "records"}` : ", inferred from this asset category's typical failure profile"}.`
      : `No repair or inspection history is on file for this asset, so the ${primaryFactor} attribution is a category-level estimate rather than a confirmed cause — flag for a physical inspection to verify.`;

    narrative = `${asset.name} is currently ${deviationClause}.${declineClause} ${evidenceClause}`;
  }

  return { severity, confidence, primaryFactor, narrative, contributingFactors };
}

/**
 * Recommends a concrete next action for an asset given its diagnosis and degradation trajectory.
 */
export function recommendAction(
  asset: Asset,
  diagnosis: AssetDiagnosis,
  degradationRatePerMonth: number,
  expectedServiceLifeYears: number,
  ageYears: number
): AssetPrescription {
  const isEol = ageYears >= expectedServiceLifeYears;
  const monthsToThreshold = degradationRatePerMonth > 0 ? (asset.condition - 70) / degradationRatePerMonth : Infinity;

  let urgency: Urgency;
  if (asset.condition < 50) urgency = "Immediate";
  else if (monthsToThreshold <= 0.5) urgency = "Urgent";
  else if (monthsToThreshold <= 2) urgency = "Scheduled";
  else urgency = "Routine";

  const recommendReplace = isEol && asset.condition < 60;

  const action = recommendReplace
    ? `Recommend replacement over repair — asset has exceeded its ${expectedServiceLifeYears}-year expected service life (currently ${ageYears} yrs) alongside sustained degradation.`
    : urgency === "Immediate"
    ? "Dispatch for immediate corrective repair."
    : urgency === "Urgent"
    ? "Schedule urgent servicing within the next 15 days."
    : urgency === "Scheduled"
    ? "Schedule preventive servicing within the current cycle."
    : "No immediate action required — continue routine inspection cadence.";

  const justification = recommendReplace
    ? `At ${degradationRatePerMonth.toFixed(1)} pts/month of continued decline driven by ${diagnosis.primaryFactor}, further repair investment offers diminishing returns given the asset is already past its rated service life.`
    : urgency === "Routine"
    ? `Health is stable relative to the compliance threshold (70%); no material decline trend has been observed.`
    : `At the observed decline rate of ${degradationRatePerMonth.toFixed(1)} pts/month — attributed primarily to ${diagnosis.primaryFactor} — condition is projected to cross the 70% compliance threshold ${monthsToThreshold <= 0 ? "immediately" : `in approximately ${monthsToThreshold < 1 ? `${Math.round(monthsToThreshold * 30)} days` : `${Math.round(monthsToThreshold)} months`}`} if left unaddressed.`;

  const expectedOutcome = recommendReplace
    ? "Replacement resets the degradation curve and removes ongoing repair cost exposure; continued repair would only defer an eventual mandatory replacement at higher cumulative cost."
    : urgency === "Routine"
    ? "Maintaining current inspection intervals is expected to keep the asset within compliance."
    : "Timely servicing is projected to restore condition to ~95% and reduce near-term failure risk; delaying intervention compounds both cost and downtime risk.";

  return { urgency, action, justification, expectedOutcome };
}

/**
 * Fleet-wide diagnostic synthesis: what pattern, if any, dominates the current failure landscape.
 */
export function synthesizeDiagnosticInsight(
  rootCauses: Record<string, number>,
  anomalyCount: number,
  totalAssets: number,
  categoryStats: { name: string; avg: number; count: number }[]
): string {
  const entries = Object.entries(rootCauses).filter(([, v]) => v > 0);
  const totalRepairs = entries.reduce((sum, [, v]) => sum + v, 0);

  if (totalRepairs === 0) {
    return "No repair events have been logged for this fleet in the current cycle, so no dominant failure pattern can be established yet.";
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topCause, topCount] = entries[0];
  const pct = Math.round((topCount / totalRepairs) * 100);

  const weakestCategory = [...categoryStats].sort((a, b) => a.avg - b.avg)[0];

  const anomalyClause = anomalyCount > 0
    ? ` ${anomalyCount} asset${anomalyCount === 1 ? " is" : "s are"} currently flagged as statistical outliers versus their category peers, warranting individual review before the next inspection cycle.`
    : " No assets currently deviate significantly from their category peer averages.";

  const categoryClause = weakestCategory
    ? ` ${weakestCategory.name} equipment shows the weakest average health at ${weakestCategory.avg}% across ${weakestCategory.count} unit${weakestCategory.count === 1 ? "" : "s"}, making it the category to prioritize for root-cause investigation.`
    : "";

  return `${topCause} issues are the leading failure driver across the fleet, accounting for ${pct}% of ${totalRepairs} logged repair event${totalRepairs === 1 ? "" : "s"}.${categoryClause}${anomalyClause}`;
}

/**
 * Fleet-wide prescriptive synthesis: where budget and dispatch attention should go next, and why.
 */
export function synthesizePrescriptiveInsight(
  replacementCandidateCount: number,
  totalReplacementBudget: number,
  labPriorities: { name: string; alertsCount: number; score: number }[]
): string {
  const topLab = labPriorities[0];

  const budgetClause = replacementCandidateCount > 0
    ? `${replacementCandidateCount} asset${replacementCandidateCount === 1 ? "" : "s"} ${replacementCandidateCount === 1 ? "has" : "have"} degraded past the point where repair is cost-effective, representing ₱${totalReplacementBudget.toLocaleString()} in projected replacement exposure this cycle.`
    : "No assets currently fall below the replacement threshold — near-term spend should stay focused on preventive servicing rather than procurement.";

  const labClause = topLab && topLab.alertsCount > 0
    ? ` ${topLab.name} Research Lab carries the highest concentration of active health alerts (${topLab.alertsCount}) and should receive first priority for technician dispatch.`
    : " No lab currently shows a concentrated cluster of alerts; dispatch can proceed on a routine, condition-based basis.";

  return `${budgetClause}${labClause}`;
}
