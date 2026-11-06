/**
 * Insight rules: the five pure checks, with a fixed "today" of 2026-11-07.
 * Covers WAR-01, LOAN-02, REP-03, LIFE-04, and COND-05 in server/features/analytics/insights.rules.ts, and the wording
 * in insights.text.ts. No database and no server.
 * Fixtures: none. Each test builds the small objects a rule reads.
 */
import { describe, expect, it } from "vitest";
import {
  conditionDropRule, dateOnly, daysBetween, lifecycleRule, overdueLoanRule, repeatRepairsRule, warrantyRule, wholeMonthsBetween,
  type RuleAsset, type RuleInspection, type RuleLoan, type RuleTicket,
} from "../../server/features/analytics/insights.rules";
import { INSIGHT_ACTIONS, INSIGHT_ALTERNATIVES, INSIGHT_ISSUES, insightOf } from "../../server/features/analytics/insights.text";

const AS_OF = "2026-11-07";

/** A DATE column value: midnight UTC of a yyyy-mm-dd. */
const dateColumn = (day: string) => new Date(`${day}T00:00:00Z`);

/** The yyyy-mm-dd that is `days` from AS_OF. */
const dayFromAsOf = (days: number) => dateOnly(new Date(dateColumn(AS_OF).getTime() + days * 86_400_000));

/** A DateTime column value at 10:00 in the server's local time zone on a yyyy-mm-dd, as the rules read it. */
const localMorning = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 10, 0, 0);
};

const asset = (overrides: Partial<RuleAsset> = {}): RuleAsset => ({
  assetId: 1, tag: "TEST-0001", name: "Test Asset", category: "DEV_KIT", status: "AVAILABLE", labCode: "TEST",
  procurementDate: null, warrantyExpiry: null, ...overrides,
});

describe("day and month counting", () => {
  it("counts whole calendar days and whole months", () => {
    expect(daysBetween("2026-11-07", "2026-11-08")).toBe(1);
    expect(daysBetween("2026-11-07", "2026-11-06")).toBe(-1);
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
    expect(wholeMonthsBetween("2022-11-07", "2026-11-07")).toBe(48);
    expect(wholeMonthsBetween("2022-11-08", "2026-11-07")).toBe(47);
  });
});

describe("WAR-01 warranty ending soon", () => {
  const withWarranty = (daysAway: number, overrides: Partial<RuleAsset> = {}) =>
    warrantyRule(asset({ warrantyExpiry: dateColumn(dayFromAsOf(daysAway)), ...overrides }), AS_OF);

  it("fires 90 days before the end and not at 91", () => {
    expect(withWarranty(90)?.priority).toBe("MEDIUM");
    expect(withWarranty(91)).toBeNull();
  });

  it("fires on the day it ends and not the day after", () => {
    expect(withWarranty(0)?.priority).toBe("HIGH");
    expect(withWarranty(-1)).toBeNull();
  });

  it("is HIGH at 30 days and MEDIUM at 31", () => {
    expect(withWarranty(30)?.priority).toBe("HIGH");
    expect(withWarranty(31)?.priority).toBe("MEDIUM");
  });

  it("skips an asset with no warranty date and a Retired asset", () => {
    expect(warrantyRule(asset({ warrantyExpiry: null }), AS_OF)).toBeNull();
    expect(withWarranty(10, { status: "RETIRED" })).toBeNull();
  });

  it("reports the days left and the date", () => {
    const hit = withWarranty(12)!;
    expect(hit.vars).toEqual({ N: 12, date: dayFromAsOf(12) });
    expect(hit.evidence).toEqual([{ label: "Warranty ends", value: dayFromAsOf(12) }]);
  });
});

describe("LOAN-02 loan well past its return date", () => {
  const loan = (daysLate: number, status = "ON_LOAN"): RuleLoan => ({
    loanId: 1, status, returnBy: dateColumn(dayFromAsOf(-daysLate)), borrowerName: "Test Borrower",
  });

  it("does not fire at 7 days late and is MEDIUM at 8", () => {
    expect(overdueLoanRule(asset(), loan(7), AS_OF)).toBeNull();
    expect(overdueLoanRule(asset(), loan(8), AS_OF)?.priority).toBe("MEDIUM");
  });

  it("is MEDIUM at 14 days and HIGH at 15", () => {
    expect(overdueLoanRule(asset(), loan(14), AS_OF)?.priority).toBe("MEDIUM");
    expect(overdueLoanRule(asset(), loan(15), AS_OF)?.priority).toBe("HIGH");
  });

  it("counts a loan that is Return Requested", () => {
    expect(overdueLoanRule(asset(), loan(10, "RETURN_REQUESTED"), AS_OF)?.priority).toBe("MEDIUM");
  });

  it("skips a loan that is not held", () => {
    for (const status of ["RETURNED", "CANCELLED", "ENDED_BY_MAINTENANCE", "PENDING_RELEASE", "DECLINED"]) {
      expect(overdueLoanRule(asset(), loan(30, status), AS_OF)).toBeNull();
    }
  });

  it("skips a Retired asset", () => {
    expect(overdueLoanRule(asset({ status: "RETIRED" }), loan(30), AS_OF)).toBeNull();
  });

  it("shows the return-by date and the borrower's name only", () => {
    expect(overdueLoanRule(asset(), loan(9), AS_OF)!.evidence).toEqual([
      { label: "Return by", value: dayFromAsOf(-9) },
      { label: "Borrower", value: "Test Borrower" },
    ]);
  });
});

describe("REP-03 repeated repairs", () => {
  let nextId = 1;
  const ticket = (daysAgo: number, status: RuleTicket["status"] = "RESOLVED"): RuleTicket => ({
    maintenanceId: nextId++, status, reportedAt: localMorning(dayFromAsOf(-daysAgo)),
  });

  it("needs 3 tickets: 2 do not fire, 3 do", () => {
    expect(repeatRepairsRule(asset(), [ticket(10), ticket(20)], null, AS_OF)).toBeNull();
    expect(repeatRepairsRule(asset(), [ticket(10), ticket(20), ticket(30)], null, AS_OF)?.priority).toBe("MEDIUM");
  });

  it("counts the day 180 days back and drops one that is 181 days back", () => {
    expect(repeatRepairsRule(asset(), [ticket(10), ticket(20), ticket(180)], null, AS_OF)).not.toBeNull();
    expect(repeatRepairsRule(asset(), [ticket(10), ticket(20), ticket(181)], null, AS_OF)).toBeNull();
  });

  it("does not count a Cancelled ticket", () => {
    expect(repeatRepairsRule(asset(), [ticket(10), ticket(20), ticket(30, "CANCELLED")], null, AS_OF)).toBeNull();
  });

  it("is HIGH when a ticket is still open", () => {
    const hit = repeatRepairsRule(asset(), [ticket(10, "REPAIRING"), ticket(20), ticket(30)], null, AS_OF);
    expect(hit?.priority).toBe("HIGH");
  });

  it("is HIGH when the condition now is Critical Defect, MEDIUM for any other", () => {
    const tickets = () => [ticket(10), ticket(20), ticket(30, "BEYOND_REPAIR")];
    expect(repeatRepairsRule(asset(), tickets(), "CRITICAL_DEFECT", AS_OF)?.priority).toBe("HIGH");
    expect(repeatRepairsRule(asset(), tickets(), "DEGRADED", AS_OF)?.priority).toBe("MEDIUM");
  });

  it("lists the ticket ids with their dates, newest first", () => {
    const [a, b, c] = [ticket(30), ticket(10), ticket(20)];
    const hit = repeatRepairsRule(asset(), [a, b, c], null, AS_OF)!;
    expect(hit.evidence.map(e => e.label)).toEqual([`MNT-${b.maintenanceId}`, `MNT-${c.maintenanceId}`, `MNT-${a.maintenanceId}`]);
    expect(hit.evidence[0].value).toBe(`${dayFromAsOf(-10)} (Resolved)`);
    expect(hit.vars.N).toBe(3);
  });

  it("skips a Retired asset", () => {
    expect(repeatRepairsRule(asset({ status: "RETIRED" }), [ticket(1), ticket(2), ticket(3)], null, AS_OF)).toBeNull();
  });
});

describe("LIFE-04 due for a lifecycle review", () => {
  const bought = (monthsAgo: number, day = "07") => {
    const d = dateColumn(`${AS_OF.slice(0, 8)}${day}`);
    d.setUTCMonth(d.getUTCMonth() - monthsAgo);
    return d;
  };

  it("fires at exactly the limit and not one month less", () => {
    expect(lifecycleRule(asset({ category: "DEV_KIT", procurementDate: bought(48) }), AS_OF)?.priority).toBe("PLANNING");
    expect(lifecycleRule(asset({ category: "DEV_KIT", procurementDate: bought(47) }), AS_OF)).toBeNull();
    expect(lifecycleRule(asset({ category: "MONITOR", procurementDate: bought(60) }), AS_OF)).not.toBeNull();
    expect(lifecycleRule(asset({ category: "ROUTER", procurementDate: bought(59) }), AS_OF)).toBeNull();
  });

  it("is not reached a day before the month is complete", () => {
    expect(lifecycleRule(asset({ category: "DEV_KIT", procurementDate: bought(48, "08") }), AS_OF)).toBeNull();
  });

  it("never fires for a category with no review point", () => {
    expect(lifecycleRule(asset({ category: "MOUSE", procurementDate: bought(200) }), AS_OF)).toBeNull();
  });

  it("skips a missing or future purchase date", () => {
    expect(lifecycleRule(asset({ procurementDate: null }), AS_OF)).toBeNull();
    expect(lifecycleRule(asset({ procurementDate: dateColumn("2030-01-01") }), AS_OF)).toBeNull();
  });

  it("skips a Retired asset and reports the months, the limit and the purchase", () => {
    expect(lifecycleRule(asset({ status: "RETIRED", procurementDate: bought(70) }), AS_OF)).toBeNull();
    const hit = lifecycleRule(asset({ category: "MONITOR", procurementDate: bought(70) }), AS_OF)!;
    expect(hit.vars).toEqual({ N: 70, L: 60 });
    expect(hit.view).toBe("strategic");
    expect(hit.evidence.map(e => e.label)).toEqual(["Purchased", "Category"]);
  });
});

describe("COND-05 condition dropping", () => {
  let nextId = 1;
  const inspection = (daysAgo: number, condition: RuleInspection["condition"], type = "ROUTINE"): RuleInspection => ({
    inspectionId: nextId++, type, condition, inspectedAt: localMorning(dayFromAsOf(-daysAgo)),
  });

  it("fires for Operational then Degraded, MEDIUM", () => {
    const hit = conditionDropRule(asset(), [inspection(20, "OPERATIONAL"), inspection(2, "DEGRADED")]);
    expect(hit?.priority).toBe("MEDIUM");
    expect(hit?.vars).toEqual({ prev: "Operational", latest: "Degraded" });
  });

  it("is HIGH when the latest is Critical Defect", () => {
    expect(conditionDropRule(asset(), [inspection(20, "PERFECT"), inspection(2, "CRITICAL_DEFECT")])?.priority).toBe("HIGH");
  });

  it("does not fire for the same condition or a better one", () => {
    expect(conditionDropRule(asset(), [inspection(20, "DEGRADED"), inspection(2, "DEGRADED")])).toBeNull();
    expect(conditionDropRule(asset(), [inspection(20, "DEGRADED"), inspection(2, "OPERATIONAL")])).toBeNull();
  });

  it("needs two TSG inspections", () => {
    expect(conditionDropRule(asset(), [inspection(2, "DEGRADED")])).toBeNull();
    expect(conditionDropRule(asset(), [])).toBeNull();
  });

  it("never counts a Self Report", () => {
    expect(conditionDropRule(asset(), [inspection(20, "OPERATIONAL"), inspection(2, "CRITICAL_DEFECT", "SELF_REPORT")])).toBeNull();
    // A newer Self Report does not hide the two TSG inspections behind it.
    expect(conditionDropRule(asset(), [inspection(20, "OPERATIONAL"), inspection(10, "DEGRADED"), inspection(1, "PERFECT", "SELF_REPORT")])).not.toBeNull();
  });

  it("does not fire when the two newest are on the same day", () => {
    expect(conditionDropRule(asset(), [inspection(2, "OPERATIONAL"), inspection(2, "DEGRADED")])).toBeNull();
  });

  it("uses the two newest whatever order they come in", () => {
    const hit = conditionDropRule(asset(), [inspection(2, "DEGRADED"), inspection(40, "PERFECT"), inspection(20, "OPERATIONAL")]);
    expect(hit?.vars).toEqual({ prev: "Operational", latest: "Degraded" });
  });

  it("skips a Retired asset", () => {
    expect(conditionDropRule(asset({ status: "RETIRED" }), [inspection(20, "OPERATIONAL"), inspection(2, "DEGRADED")])).toBeNull();
  });
});

describe("insight wording", () => {
  const hit = warrantyRule(asset({ name: "Scope", tag: "TEST-0042", warrantyExpiry: dateColumn(dayFromAsOf(5)) }), AS_OF)!;

  it("fills the asset as Name (TAG) and the numbers", () => {
    const insight = insightOf(hit, "staff");
    expect(insight.id).toBe("WAR-01:TEST-0042");
    expect(insight.issue).toBe(`The warranty for Scope (TEST-0042) ends in 5 days (${dayFromAsOf(5)}).`);
    expect(insight.title).toBe("Warranty ending soon");
  });

  it("words the action for each audience", () => {
    expect(insightOf(hit, "labHead").preferredAction).toBe("Consider asking TSG for a condition check before it ends.");
    expect(insightOf(hit, "staff").preferredAction).toBe("Consider an inspection before the warranty ends.");
    expect(insightOf(hit, "director").preferredAction).toBe("Review assets whose warranty ends soon.");
  });

  it("gives one or two ranked alternatives for every rule", () => {
    for (const texts of Object.values(INSIGHT_ALTERNATIVES)) expect([1, 2]).toContain(texts.length);
    expect(insightOf(hit, "staff").alternatives.map(a => a.rank)).toEqual([1, 2]);
  });

  it("uses neutral words and no em dash", () => {
    const all = [
      ...Object.values(INSIGHT_ISSUES),
      ...Object.values(INSIGHT_ACTIONS).flatMap(a => Object.values(a)),
      ...Object.values(INSIGHT_ALTERNATIVES).flat(),
    ].join(" ");
    expect(all).not.toMatch(/\bmust\b|unusable|warranty eligible|\bbuy\b|—/i);
  });
});
