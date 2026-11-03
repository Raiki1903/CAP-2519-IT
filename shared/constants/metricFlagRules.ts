/**
 * When a benchmark value is flagged: one rule per metric_key of metric_definitions, and the health score rule for
 * categories with no metrics.
 * Layer: shared. Imported by the server (benchmark data, Batch 5) and web/ (the inspection and benchmark screens). Imports nothing.
 * Used by: TSG inspections and the benchmark charts.
 */

/**
 * One flag rule. The baseline is the asset's first recorded value of that metric (normally from its Initial
 * inspection); a rule that needs one never flags while there is none.
 */
export interface MetricFlagRule {
  /** The rule in plain words, for the screen's legend. */
  description: string;
  /** Whether the rule compares against the baseline. */
  needsBaseline: boolean;
  /**
   * Whether the value is flagged.
   *
   * @param value the value just recorded
   * @param baseline the asset's first recorded value of this metric, or null when there is none
   */
  isFlagged(value: number, baseline: number | null): boolean;
}

/** The flag rule for each metric_key in metric_definitions. A key with no rule here is never flagged. */
export const METRIC_FLAG_RULES: Record<string, MetricFlagRule> = {
  CPU_LOAD_TEMP: {
    description: "15 °C or more above the baseline",
    needsBaseline: true,
    isFlagged: (value, baseline) => baseline !== null && value >= baseline + 15,
  },
  BAD_SECTORS: {
    description: "Any rise above the baseline",
    needsBaseline: true,
    isFlagged: (value, baseline) => baseline !== null && value > baseline,
  },
  BATTERY_CAPACITY: {
    description: "Below 70% of the design capacity",
    needsBaseline: false,
    isFlagged: (value) => value < 70,
  },
  READ_SPEED: {
    description: "Below 80% of the baseline",
    needsBaseline: true,
    isFlagged: (value, baseline) => baseline !== null && value < baseline * 0.8,
  },
  WORKING_PORTS: {
    description: "Fewer working ports than the baseline",
    needsBaseline: true,
    isFlagged: (value, baseline) => baseline !== null && value < baseline,
  },
  PACKET_LOSS: {
    description: "Above 1%",
    needsBaseline: false,
    isFlagged: (value) => value > 1,
  },
  SENSOR_DRIFT: {
    description: "Above 5%",
    needsBaseline: false,
    isFlagged: (value) => value > 5,
  },
  MOTOR_SPEED: {
    description: "More than 10% off the baseline",
    needsBaseline: true,
    isFlagged: (value, baseline) => baseline !== null && Math.abs(value - baseline) > Math.abs(baseline) * 0.1,
  },
};

/** For a category with no metrics, a health score below this is flagged. */
export const HEALTH_SCORE_FLAG_BELOW = 50;

/**
 * Whether a metric value is flagged by its rule.
 *
 * @param metricKey metric_definitions.metric_key
 * @param value the value just recorded
 * @param baseline the asset's first recorded value of this metric, or null
 * @returns false for a key with no rule
 */
export function isMetricFlagged(metricKey: string, value: number, baseline: number | null): boolean {
  const rule = METRIC_FLAG_RULES[metricKey];
  return rule ? rule.isFlagged(value, baseline) : false;
}

/**
 * Whether a health score is flagged, for a category with no metrics.
 *
 * @param healthScore 0 to 100
 */
export function isHealthScoreFlagged(healthScore: number): boolean {
  return healthScore < HEALTH_SCORE_FLAG_BELOW;
}
