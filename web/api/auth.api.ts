/**
 * Auth API: login, the current user's profile, and sign-up requests.
 * Layer: api. Called by Login, Register, AccountDetailsPage, state/session.tsx, and state/serverData.tsx. Calls client.ts.
 * Used by: login for every role, self-registration, approval of sign-ups, account page.
 */
import { apiGet, apiPost, apiPostRaw, apiPut, type ApiResult } from "./client";

/** What the account page sends when saving a profile. */
export interface AccountUpdateInput {
  /** Identifies whose account to change. */
  // TODO(C-06): the server trusts this email instead of a session. Step 13 (requireAuth).
  email: string;
  firstName: string;
  lastName: string;
  /** The caller sends the same picture under these three names. */
  avatarUrl: string;
  profilePicture: string;
  userImg: string;
  labAffiliation?: string;
}

/**
 * Checks an email and password.
 *
 * @param email the institutional email, already trimmed
 * @param password the password as typed
 * @returns `success`, `role` (an app Role), and `user`; or `error`
 */
export function login(email: string, password: string): Promise<ApiResult> {
  return apiPost("/api/auth/login", { email, password });
}

/**
 * Loads a user's profile and role by email.
 *
 * @param email the email from the session cookie
 * @returns `success` and `user`
 */
// TODO(C-06): any email works, there is no session check on the server. Step 13 (requireAuth).
export function getMe(email: string): Promise<ApiResult> {
  return apiGet(`/api/auth/me?email=${encodeURIComponent(email)}`);
}

/**
 * Saves the name, picture, and lab of an account.
 *
 * @param input the account's email and the new profile values
 * @returns `success` and the saved `user`
 */
export function updateAccount(input: AccountUpdateInput): Promise<ApiResult> {
  return apiPut("/api/auth/account", input);
}

/**
 * Files a sign-up request. Returns the untouched Response because Register
 * checks the content type and status itself.
 *
 * @param registration the registration form values
 * @returns the raw Response
 */
// TODO(H-17): the server keeps pending sign-ups, password included, in a JSON file. Phase 3 makes it a table.
export function requestRegistrationRaw(registration: unknown): Promise<Response> {
  return apiPostRaw("/api/auth/register-request", registration);
}

/**
 * Lists sign-up requests waiting for approval.
 *
 * @returns `success` and `pendingRegistrations`
 */
// TODO(C-04): the answer includes each applicant's password and needs no login. Step 13 and Phase 3.
export function listPendingRegistrations(): Promise<ApiResult> {
  return apiGet("/api/auth/pending-registrations");
}

/**
 * Approves a sign-up request, which creates the user.
 *
 * @param registration `requestId`, plus the registration's own fields when the caller has them
 * @returns `success`, or `error` when the user could not be created
 */
// TODO(C-05): the server creates an account from the body when the request id is unknown. Phase 3 removes that fallback.
export function approveRegistration(registration: unknown): Promise<ApiResult> {
  return apiPost("/api/auth/approve-registration", registration);
}

/**
 * Rejects a sign-up request. Returns the untouched Response because the
 * caller never reads the answer.
 *
 * @param requestId the registration's id
 * @returns the raw Response
 */
export function rejectRegistrationRaw(requestId: string): Promise<Response> {
  return apiPostRaw("/api/auth/reject-registration", { requestId });
}
