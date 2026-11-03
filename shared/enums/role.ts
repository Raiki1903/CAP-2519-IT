/**
 * The roles the web app routes and renders by, their labels, the database role names and their labels, and the Staff unit.
 * Layer: shared. Imported by server/features/auth/auth.service.ts (login, /me, and the session check), server/shared/middleware/requireRole.ts, shared/types/auth.ts, and web/ (state/session.tsx, app shell, Login, NotificationCenter, and the screens that check the role). Imports nothing.
 * Used by: login, navigation, and every role dashboard.
 */

/**
 * An app role, as returned by the login and /me endpoints.
 * These are not the database role names (`roles_role_name`, such as RESEARCHER):
 * the server maps those to one of these at login.
 * TSG and Secretary accounts are both `Staff`: they share one route tree (`/staff/*`) and the same screens.
 * `StaffUnit` says which unit they are. The IT Admin has its own view (`/it-admin/*`) and no asset screens.
 */
export type Role = "Staff" | "LabHead" | "Custodian" | "AdRICDirector" | "ITAdmin";

/**
 * The label shown for each app role. The key "Custodian" stays because the screens and routes are built on it
 * (`/custodian/*`), but the person is a Researcher.
 */
export const APP_ROLE_LABELS: Record<Role, string> = {
  Staff: "Staff",
  LabHead: "Lab Head",
  Custodian: "Researcher",
  AdRICDirector: "AdRIC Director",
  ITAdmin: "IT Admin",
};

/**
 * Every value of roles.role_name. Must match the `roles_role_name` enum in schema.prisma. There is no Lab Head role:
 * heading a lab (research_centers.head_user_id) gives the Lab Head view.
 */
export const DATABASE_ROLES = ["RESEARCHER", "TSG_STAFF", "ADRIC_DIRECTOR", "ADRIC_SECRETARY", "IT_ADMIN"] as const;

/** One value of roles.role_name. */
export type DatabaseRole = (typeof DATABASE_ROLES)[number];

/** The label shown for each database role. */
export const DATABASE_ROLE_LABELS: Record<DatabaseRole, string> = {
  RESEARCHER: "Researcher",
  TSG_STAFF: "TSG Staff",
  ADRIC_DIRECTOR: "AdRIC Director",
  ADRIC_SECRETARY: "AdRIC Secretary",
  IT_ADMIN: "IT Admin",
};

/**
 * Which unit a Staff account belongs to. The database keeps the two roles apart
 * (ITS: `ADRIC_SECRETARY`; TSG: `TSG_STAFF`), and the session
 * keeps the difference because issue #41 will give ITS and TSG different edit and
 * delete rights. Today it only fills in the unit on a Send to Maintenance ticket
 * (its text, and a forwarding field the server does not store yet) and labels the
 * sidebar's session card.
 */
export type StaffUnit = "ITS" | "TSG";
