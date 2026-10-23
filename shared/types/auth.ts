/**
 * Request and response shapes of the auth and registration endpoints.
 * Layer: shared. Imported by server/features/auth/, server/shared/middleware/requireAuth.ts, the loans, transfers, and assets
 * services (SessionIdentity, to hide names from a Custodian), and web/api/auth.api.ts. Imports shared/enums/role.ts.
 * Used by: login, the session reload, the account page, self-registration, and the Lab Head's sign-up approvals.
 */
import type { Role, StaffUnit } from '../enums/role';

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
  /** Plain text in the file (C-03, H-17), and never sent: the answers use PendingRegistrationView. (C-04) */
  password?: string;
  avatarUrl?: string;
  /** A display date such as "Oct 11, 2026", not a timestamp. */
  submittedAt: string;
  /** Always PENDING in the list: approval and rejection remove the request. */
  status: "PENDING" | "APPROVED" | "REJECTED";
}

/**
 * A sign-up request as GET /api/auth/pending-registrations and POST /api/auth/register-request send it: the stored
 * request without its password, which no screen shows. (C-04)
 */
export type PendingRegistrationView = Omit<PendingRegistration, "password">;

/** The `user` of a POST /api/auth/approve-registration answer: the new account's id, names, and email only. (01C 4.1) */
export interface ApprovedUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
}

/** The body of POST /api/auth/approve-registration. Any other field is ignored: the account comes from the stored request. (C-05) */
export interface ApproveRegistrationInput {
  /** The REG- id the server gave the request. */
  requestId: string;
}

/** The body of POST /api/auth/login. */
export interface LoginInput {
  email: string;
  password: string;
}

/** What the account page sends when saving a profile. */
export interface AccountUpdateInput {
  firstName: string;
  lastName: string;
  /** The caller sends the same picture under these three names. */
  avatarUrl: string;
  profilePicture: string;
  userImg: string;
  /**
   * A research center's short code to move the account to; an unknown code is refused (400). The account page sends
   * none, so the lab stays as it is. (issue #73)
   */
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
  /** The account's lab after the save: the short code of its first lab link, or "CITe4D" when it has none (as login and /me). */
  labAffiliation: string;
}

/** Who a valid session cookie belongs to, as requireAuth finds them on each request. Server only; never sent. */
export interface SessionIdentity {
  userId: number;
  role: Role;
  staffUnit: StaffUnit | null;
}
