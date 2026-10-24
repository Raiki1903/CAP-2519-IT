/**
 * Lab affiliation matcher: strictly compares user lab affiliation with a record lab.
 * Layer: feature helper. Called by NotificationCenter.tsx and LabHeadDashboard.tsx.
 * Calls: nothing.
 * Used by: Lab Head loan and transfer notifications, custody requests. (F-31)
 */

/**
 * Returns true when a user lab affiliation matches a record lab affiliation.
 * Returns false if either userLab or lab is missing, undefined, null, or empty string.
 * Matches by exact string equality (case-insensitive, trimmed), substring inclusion,
 * or parenthesized short code (for example, "Center for ICT for Development (CITe4D)" matches "CITe4D").
 *
 * @param userLab the user's lab affiliation from session (currentUser?.labAffiliation)
 * @param lab the record's lab affiliation or destination lab
 * @returns true if the affiliations match, false otherwise
 */
export function labMatches(
  userLab: string | undefined | null,
  lab: string | undefined | null
): boolean {
  if (!userLab || !lab) {
    return false;
  }

  const target = userLab.trim().toLowerCase();
  const candidate = lab.trim().toLowerCase();

  if (!target || !candidate) {
    return false;
  }

  // Exact match (case-insensitive, trimmed)
  if (target === candidate) {
    return true;
  }

  // Substring inclusion
  if (target.includes(candidate) || candidate.includes(target)) {
    return true;
  }

  // Parenthesized short code matching
  const userMatch = userLab.match(/\(([^)]+)\)/);
  if (userMatch) {
    const userCode = userMatch[1].toLowerCase().replace(/\s*lab\s*/g, "").trim();
    if (userCode && (candidate === userCode || candidate.includes(userCode) || userCode.includes(candidate))) {
      return true;
    }
  }

  const candMatch = lab.match(/\(([^)]+)\)/);
  if (candMatch) {
    const candCode = candMatch[1].toLowerCase().replace(/\s*lab\s*/g, "").trim();
    if (candCode && (target === candCode || target.includes(candCode) || candCode.includes(target))) {
      return true;
    }
  }

  if (userMatch && candMatch) {
    const userCode = userMatch[1].toLowerCase().replace(/\s*lab\s*/g, "").trim();
    const candCode = candMatch[1].toLowerCase().replace(/\s*lab\s*/g, "").trim();
    if (userCode && candCode && userCode === candCode) {
      return true;
    }
  }

  return false;
}
