/**
 * The roles the web app routes and renders by, and the Staff unit.
 * Layer: shared. Imported by server.ts (login and /me) and by web/ (state/session.tsx, app shell, Login, NotificationCenter, and the screens that check the role). Imports nothing.
 * Used by: login, navigation, and every role dashboard.
 */

/**
 * An app role, as returned by the login and /me endpoints.
 * These are not the database role names (`roles_role_name`, such as LAB_HEAD):
 * the server maps those to one of these at login.
 * ITS and TSG accounts are both `Staff`: they do the same job, so they share one
 * route tree (`/staff/*`) and the same screens. `StaffUnit` says which unit they are.
 */
export type Role = "Staff" | "LabHead" | "Custodian" | "AdRICDirector";

/**
 * Which unit a Staff account belongs to. The database keeps the two roles apart
 * (ITS: `ADMIN`, `ADRIC_SECRETARY`, `ITS_STAFF`; TSG: `TSG_STAFF`), and the session
 * keeps the difference because issue #41 will give ITS and TSG different edit and
 * delete rights. Today it only decides where Send to Maintenance forwards a ticket
 * and the label on the sidebar's session card.
 */
export type StaffUnit = "ITS" | "TSG";
