/**
 * Analytics scope: which lab a Lab Head, Staff member, or Director may read in the figures that can be narrowed to one lab.
 * Layer: service helper. Called by insights.service.ts and utilization.service.ts. Calls analytics.repository.ts (findLab).
 * Used by: the Staff, Lab Head, and Director insights and loans per week.
 * A Lab Head is always limited to the lab they head. Staff and the Director may pick a lab, which must exist.
 */
import type { InsightScope } from '@shared/types/analytics';
import type { SessionIdentity } from '@shared/types/auth';
import { AppError } from '../../shared/errors/AppError';
import * as analyticsRepository from './analytics.repository';

/** The 403 message for a Lab Head who asks for another lab. */
export const OTHER_LAB_MESSAGE = "Lab Heads see only their own lab.";

/** The 403 message for a Lab Head account that heads no lab. */
export const NO_LAB_MESSAGE = "Only the account that heads a lab has lab insights.";

/** The 400 message for a lab that does not exist. */
export const UNKNOWN_LAB_MESSAGE = "That lab does not exist.";

/** The 403 message for a role that has no insights (Researcher, IT Admin). */
export const NO_INSIGHTS_MESSAGE = "Your role has no insights.";

/**
 * The lab to read for one viewer.
 *
 * @param viewer the session user
 * @param requested the `centerId` asked for, or null for the viewer's whole scope
 * @returns one lab, or every lab (Staff and the Director with no `centerId`)
 * @throws AppError 403 for a role with no figures, a Lab Head with no lab, or a Lab Head asking for another lab
 * @throws AppError 400 when Staff or the Director ask for a lab that does not exist
 */
export async function resolveScope(viewer: SessionIdentity, requested: number | null): Promise<InsightScope> {
    if (viewer.role === 'LabHead') {
        if (viewer.headOfCenterId === null) throw new AppError(403, NO_LAB_MESSAGE);
        if (requested !== null && requested !== viewer.headOfCenterId) throw new AppError(403, OTHER_LAB_MESSAGE);
        const lab = await analyticsRepository.findLab(viewer.headOfCenterId);
        if (!lab) throw new AppError(403, NO_LAB_MESSAGE);
        return { type: 'lab', centerId: lab.center_id, code: lab.short_code };
    }
    if (viewer.role !== 'Staff' && viewer.role !== 'AdRICDirector') throw new AppError(403, NO_INSIGHTS_MESSAGE);
    if (requested === null) return { type: 'all', centerId: null, code: null };
    const lab = await analyticsRepository.findLab(requested);
    if (!lab) throw new AppError(400, UNKNOWN_LAB_MESSAGE);
    return { type: 'lab', centerId: lab.center_id, code: lab.short_code };
}
