/**
 * The roles the web app routes and renders by.
 * Layer: shared. Imported by web/ (context.tsx, Login, Sidebar, NotificationCenter). Imports nothing.
 * Used by: login, navigation, and every role dashboard.
 */

/**
 * An app role, as returned by the login and /me endpoints.
 * These are not the database role names (`roles_role_name`, such as LAB_HEAD):
 * the server maps those to one of these at login.
 */
export type Role = "Staff" | "LabHead" | "Custodian" | "AdRICDirector";

export type StaffUnit = "ITS" | "TSG";
