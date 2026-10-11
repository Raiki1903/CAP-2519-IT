/**
 * Request and response shapes of the auth and registration endpoints.
 * Layer: shared. Imported by server/features/auth/ and web/api/auth.api.ts. Imports shared/enums/role.ts.
 * Used by: login, the session reload, the account page, self-registration, and the Lab Head's sign-up approvals.
 */
import type { StaffUnit } from '../enums/role';

/** The body of POST /api/auth/register. No screen sends it. */
export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** Stored as a number. */
  idNumber: number | string;
  /** STUDENT when not sent. */
  userType?: "STUDENT" | "FACULTY" | "STAFF";
  /** research_centers.center_id to link the account to; no link when not sent. */
  centerId?: number | string;
}

/** The body of POST /api/auth/register-request, as Register sends it (Register also sends fields the server ignores). */
export interface RegistrationRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number | string;
  /** STUDENT when not sent. */
  userType?: "STUDENT" | "FACULTY" | "STAFF";
  /** Free text such as "Custodian" or "Lab Head"; Custodian when not sent. Approval maps its wording to a database role. */
  requestedRole?: string;
  /** A lab name or code; CITe4D when not sent. */
  labAffiliation?: string;
  /** "password123" when not sent. (C-03) */
  password?: string;
  /** The picture as a data URL; becomes users.user_img on approval. */
  avatarUrl?: string;
}

/** One sign-up request, as kept in pending_registrations.json and listed by GET /api/auth/pending-registrations. (H-17) */
export interface PendingRegistration {
  /** "REG-" and six random digits. */
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  requestedRole: string;
  labAffiliation: string;
  /** Plain text, and sent with every listing. (C-03, C-04; issue #72) */
  password?: string;
  avatarUrl?: string;
  /** A display date such as "Oct 11, 2026", not a timestamp. */
  submittedAt: string;
  /** Always PENDING in the list: approval and rejection remove the request. */
  status: "PENDING" | "APPROVED" | "REJECTED";
}

/**
 * The body of POST /api/auth/approve-registration: the request id, plus the request's own fields when the caller has them.
 * The fields are used only when the id matches no request. (C-05, issue #71)
 */
export interface ApproveRegistrationInput {
  requestId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  idNumber?: number | string;
  userType?: "STUDENT" | "FACULTY" | "STAFF";
  requestedRole?: string;
  labAffiliation?: string;
  password?: string;
}

/** The body of POST /api/auth/login. */
export interface LoginInput {
  email: string;
  password: string;
}

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

/** The `user` of a login answer: the profile the session keeps. */
export interface LoginUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  /** The picture, the same value under two names. */
  userImg: string | null;
  profilePicture: string | null;
  /** Short code of the account's first lab link, or "CITe4D" when it has none. */
  labAffiliation: string;
  /** ITS or TSG for a Staff account, otherwise null. */
  staffUnit: StaffUnit | null;
}

/** The `user` of a GET /api/auth/me answer: the login profile with the app role inside it. */
export interface ProfileUser extends LoginUser {
  /** An app Role: "Staff", "LabHead", "Custodian", or "AdRICDirector". */
  role: string;
}

/** The `user` of a PUT /api/auth/account answer. Unlike login, it has no staffUnit, and the picture comes under three names. */
export interface AccountUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  userImg: string | null;
  profilePicture: string | null;
  avatarUrl: string | null;
  /** The lab code the request sent, or "CITe4D" when it sent none, whatever the account's lab is. */
  labAffiliation: string;
}
