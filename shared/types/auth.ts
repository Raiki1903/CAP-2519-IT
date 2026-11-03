/**
 * Request and response shapes of the auth and registration endpoints.
 * Layer: shared. Imported by server/features/auth/, server/shared/middleware/ (requireAuth and the permission checks),
 * the loans, transfers, and assets services (SessionIdentity, to hide names from a Custodian), and web/api/auth.api.ts.
 * Imports shared/enums/role.ts and shared/constants/accountStatuses.ts.
 * Used by: login, the session reload, the account page, and self-registration.
 */
import type { DatabaseRole, Role, StaffUnit } from '../enums/role';
import type { AccountStatus } from '../constants/accountStatuses';
import type { UserType } from '../constants/signUp';

/**
 * The body of POST /api/auth/register-request, as the server reads it after its checks: the email trimmed and in
 * lower case, the ID number as a number, and each lab once.
 */
export interface SignUpRequest {
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: UserType;
  /** The password as typed. The server stores only its hash. (C-03) */
  password: string;
  /** The labs the applicant asks to join, at least one. The IT Admin confirms or changes them on approval. */
  centerIds: number[];
  /** The picture as a data URL; becomes users.user_img. */
  avatarUrl?: string;
}

/**
 * The form values web/pages/auth/Register.tsx sends. The server reads the body as a SignUpRequest and refuses one
 * without `centerIds` (400).
 */
export interface RegistrationRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number | string;
  /** STUDENT when not sent. */
  userType?: "STUDENT" | "FACULTY" | "STAFF";
  /** A lab name or code; no lab when not sent. */
  labAffiliation?: string;
  /** The password as typed. The server stores only its hash. (C-03) */
  password: string;
  /** The picture as a data URL; becomes users.user_img on approval. */
  avatarUrl?: string;
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

/** What the account page sends when saving a profile. A `labAffiliation` is refused (400): the lab is not changed here. (issue #73) */
export interface AccountUpdateInput {
  firstName: string;
  lastName: string;
  /** The caller sends the same picture under these three names. */
  avatarUrl: string;
  profilePicture: string;
  userImg: string;
}

/** One lab of the session user. */
export interface SessionLab {
  centerId: number;
  code: string;
  name: string;
  campus: "MANILA" | "LAGUNA" | "MCKINLEY";
}

/**
 * The `user` of a login answer: the profile the session keeps (docs/contracts/lifecycle.md, SessionUser). `labs` lists
 * every lab the person belongs to; there is no first or default lab, and a person with no lab gets [].
 */
export interface LoginUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  /** The person's own ID number, so the loan form can prefill it. Never anyone else's. */
  idNumber: number | null;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  /** The picture, the same value under two names. */
  userImg: string | null;
  profilePicture: string | null;
  labs: SessionLab[];
  /** The lab this account heads, or null. Heading a lab gives the Lab Head view. */
  headOf: { centerId: number; code: string } | null;
  accountStatus: AccountStatus;
  /** ITS or TSG for a Staff account, otherwise null. */
  staffUnit: StaffUnit | null;
}

/** The `user` of a GET /api/auth/me answer: the login profile with the app role and its label inside it. */
export interface ProfileUser extends LoginUser {
  /** An app Role: "Staff", "LabHead", "Custodian", "AdRICDirector", or "ITAdmin". */
  role: string;
  /** The role's label: a Custodian shows "Researcher". */
  roleLabel: string;
}

/** The `user` of a PUT /api/auth/account answer. Unlike login, it has no staffUnit, and the picture comes under three names. */
export interface AccountUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number | null;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  userImg: string | null;
  profilePicture: string | null;
  avatarUrl: string | null;
  /** The account's labs after the save, as login and /me give them. */
  labs: SessionLab[];
}

/** Who a valid session cookie belongs to, as requireAuth finds them on each request. Server only; never sent. */
export interface SessionIdentity {
  userId: number;
  /** The app role, which picks the view. */
  role: Role;
  staffUnit: StaffUnit | null;
  /** The account's database roles, which the permission checks read. */
  dbRoles: DatabaseRole[];
  /** Only an ACTIVE account may act (requireActive). */
  accountStatus: AccountStatus;
  /** The research center this account heads, or null. */
  headOfCenterId: number | null;
}
