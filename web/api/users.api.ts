/**
 * Users API: the IT Admin's Pending sign-ups, and approving or rejecting one. The only place these URLs appear in the frontend.
 * Layer: api. Called by state/pendingSignUps.tsx and features/users/ (the approve and reject dialogs). Calls client.ts;
 * types from @shared/types/users.
 * Used by: the IT Admin's Approvals page.
 */
import type { ApproveSignUpInput, RejectSignUpInput } from "@shared/types/users";
import { apiGetRaw, apiPutRaw, readResult, type ApiResult } from "./client";

/**
 * Lists the sign-ups waiting for the IT Admin, oldest first.
 *
 * @returns `success` and `users`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function listPendingUsers(): Promise<ApiResult> {
  return readResult(await apiGetRaw("/api/users?status=PENDING"), "Could not load the sign-ups. Try again.");
}

/**
 * Approves a Pending sign-up with one role and its labs. The IT Admin is read from the session, not sent.
 *
 * @param userId the account
 * @param input the role, and the labs (at least one for a Researcher)
 * @returns `success` and the approved `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function approveSignUp(userId: number, input: ApproveSignUpInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/approve`, input), "Could not approve this sign-up. Try again.");
}

/**
 * Rejects a Pending sign-up, with optional remarks for the activity log.
 *
 * @param userId the account
 * @param input the remarks, or null for none
 * @returns `success` and the rejected `user`; or `error` with the server's sentence
 * @throws if the server cannot be reached
 */
export async function rejectSignUp(userId: number, input: RejectSignUpInput): Promise<ApiResult> {
  return readResult(await apiPutRaw(`/api/users/${userId}/reject`, input), "Could not reject this sign-up. Try again.");
}
