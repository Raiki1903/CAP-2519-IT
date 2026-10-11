import type { StaffUnit } from '../enums/role';

/** The body of POST /api/auth/register. */
export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  idNumber: number | string;
  userType?: "STUDENT" | "FACULTY" | "STAFF";
  centerId?: number | string;
}

/** The body of POST /api/auth/register-request. */
export interface RegistrationRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number | string;
  userType?: "STUDENT" | "FACULTY" | "STAFF";
  requestedRole?: string;
  labAffiliation?: string;
  password?: string;
  avatarUrl?: string;
}

/** One sign-up request in pending_registrations.json. */
export interface PendingRegistration {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  requestedRole: string;
  labAffiliation: string;
  password?: string;
  avatarUrl?: string;
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

/** The body of POST /api/auth/approve-registration. */
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

/** The `user` of a login answer. */
export interface LoginUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: "STUDENT" | "FACULTY" | "STAFF";
  userImg: string | null;
  profilePicture: string | null;
  labAffiliation: string;
  staffUnit: StaffUnit | null;
}

/** The `user` of a GET /api/auth/me answer. */
export interface ProfileUser extends LoginUser {
  role: string;
}

/** The `user` of a PUT /api/auth/account answer. */
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
  labAffiliation: string;
}
