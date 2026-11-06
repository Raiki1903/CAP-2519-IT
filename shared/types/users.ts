/**
 * Request and response shapes of the IT Admin's account endpoints (docs/contracts/lifecycle.md, section 7.7).
 * Layer: shared. Imported by server/features/users/ and web/api/users.api.ts. Imports shared/enums/role.ts and
 * shared/constants (account statuses, user types).
 * Used by: the IT Admin's Approvals page; module 6 adds the Users page.
 */
import type { DatabaseRole } from '../enums/role';
import type { AccountStatus } from '../constants/accountStatuses';
import type { UserType } from '../constants/signUp';

/** One lab of an account, by its code. */
export interface UserLab {
  centerId: number;
  code: string;
}

/** An account as the IT Admin sees it (contract "Common objects", User). Sent only to the IT Admin; never a password. */
export interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number | null;
  userType: UserType;
  /** The database role, or null for a Pending sign-up, which has none yet. */
  role: DatabaseRole | null;
  roleLabel: string | null;
  accountStatus: AccountStatus;
  /** Every lab the account belongs to, by code. For a Pending sign-up, the labs it asked for. */
  labs: UserLab[];
  headOf: UserLab | null;
}

/**
 * The filters of GET /api/users, each optional and one value each. With no status, every account but the Pending
 * ones is listed.
 */
export interface UserListFilters {
  status?: AccountStatus;
  role?: DatabaseRole;
  /** A lab the account belongs to. */
  centerId?: number;
  /** Part of the name, email, or ID number, trimmed; any case. */
  q?: string;
}

/** The body of PUT /api/users/:userId/approve. */
export interface ApproveSignUpInput {
  role: DatabaseRole;
  /** The account's labs from now on, each once: at least one for a Researcher, zero or more for the other roles. */
  centerIds: number[];
}

/** The body of PUT /api/users/:userId/role. */
export interface ChangeRoleInput {
  role: DatabaseRole;
}

/** The body of PUT /api/users/:userId/labs. */
export interface ChangeLabsInput {
  /** The account's labs from now on, each once: at least one for a Researcher. */
  centerIds: number[];
}

/** The body of PUT /api/users/:userId/reject. */
export interface RejectSignUpInput {
  /** Trimmed, at most REJECT_REMARKS_MAX_LENGTH characters; null when none were given. */
  remarks: string | null;
}
