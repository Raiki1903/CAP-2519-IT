/**
 * The permission rules that need the asset or the request row: who approves a lab's loans, and that the person who
 * asked for something is not the one who decides it.
 * Layer: shared service. Called by the services of features/loans (approver) and retirements (requester). Calls
 * features/assets/assets.repository.ts and shared/errors/AppError.ts.
 * Used by: Lab Head loan decisions, Director and Secretary retirement decisions.
 */
import * as assetsRepository from '../../features/assets/assets.repository';
import { AppError } from '../errors/AppError';

/** The 409 message when the asset's home lab has no Head to approve its loans. */
export const NO_LAB_HEAD_MESSAGE = "This lab has no Lab Head yet. Ask the IT Admin to set one.";

/** The 403 message when a Lab Head acts on another lab's asset. */
export const NOT_YOUR_LAB_MESSAGE = "This asset belongs to another lab. Only that lab's Head can decide its loans.";

/**
 * Who approves loans of this asset: today the Head of its home lab. Later this can return a custodian instead.
 *
 * @param asset the asset, by its home lab
 * @returns the approver's user id, or null when the lab has no Head
 */
export async function resolveLoanApprover(asset: { center_id: number }): Promise<number | null> {
    const lab = await assetsRepository.findLabById(asset.center_id);
    return lab?.head_user_id ?? null;
}

/**
 * Refuses a loan decision by anyone but the approver of the asset's home lab.
 *
 * @param asset the asset of the loan
 * @param actorId the session user
 * @throws AppError 409 NO_LAB_HEAD_MESSAGE when the lab has no Head
 * @throws AppError 403 NOT_YOUR_LAB_MESSAGE when the session user is not that lab's Head
 */
export async function requireHomeLabHead(asset: { center_id: number }, actorId: number): Promise<void> {
    const approverId = await resolveLoanApprover(asset);
    if (approverId === null) throw new AppError(409, NO_LAB_HEAD_MESSAGE);
    if (approverId !== actorId) throw new AppError(403, NOT_YOUR_LAB_MESSAGE);
}

/**
 * Refuses a decision by the person who made the request, so every request is decided by a second person.
 *
 * @param requesterId who made the request
 * @param actorId the session user who decides
 * @param message the 403 message
 * @throws AppError 403 with the message when the two are the same person
 */
export function notSameActor(requesterId: number, actorId: number, message: string): void {
    if (requesterId === actorId) throw new AppError(403, message);
}
