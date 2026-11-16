/**
 * Route table: which URL shows which screen, one tree per role under RootLayout.
 * Layer: shared (app shell). Called by app/App.tsx.
 * Calls: the screens in web/pages/.
 * Used by: every role.
 */
import { createBrowserRouter, Navigate, useLocation } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { Login } from "@web/pages/auth/Login";
import { Register } from "@web/pages/auth/Register";
import { OverviewPage } from "@web/pages/staff/OverviewPage";
import { RegisterPage } from "@web/pages/staff/RegisterPage";
import { InventoryPage } from "@web/pages/staff/InventoryPage";
import { RepairsPage } from "@web/pages/staff/RepairsPage";
import { InspectionsPage } from "@web/pages/staff/InspectionsPage";
import { LoansPage } from "@web/pages/staff/LoansPage";
import { ReturnsPage } from "@web/pages/staff/ReturnsPage";
import { QrTagsPage } from "@web/pages/staff/QrTagsPage";
import { HealthPage } from "@web/pages/staff/HealthPage";
import { LabHeadDashboard } from "@web/pages/lab-head/LabHeadDashboard";
import { CustodianPortal } from "@web/pages/custodian/CustodianPortal";
import { AdRICDirectorDashboard } from "@web/pages/director/AdRICDirectorDashboard";
import { ApprovalsPage } from "@web/pages/it-admin/ApprovalsPage";
import { UsersPage } from "@web/pages/it-admin/UsersPage";
import { ActivityLogPage } from "@web/pages/it-admin/ActivityLogPage";
import { TicketsPage } from "@web/pages/it-admin/TicketsPage";
import { AccountDetailsPage } from "@web/pages/AccountDetailsPage";
import { SupportTicketsPage } from "@web/pages/shared/SupportTicketsPage";
import { AccountabilityFormPage } from "@web/pages/shared/AccountabilityFormPage";
import { ClearancePrintPage } from "@web/pages/staff/ClearancePrintPage";
import { DisposalRecordPrintPage } from "@web/pages/shared/DisposalRecordPrintPage";
import { NotFound } from "@web/pages/NotFound";

/**
 * Sends a pre-merge URL (`/its/...` or `/tsg/...`) to the same tab under `/staff/...`,
 * keeping the query string and hash, so bookmarks and shared links still work.
 * It runs outside RootLayout on purpose: inside it, RootLayout would see a URL that is
 * not the Staff tree and send the user to their default page instead of the tab they asked for.
 */
function OldStaffUrlRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={pathname.replace(/^\/(its|tsg)(?=\/|$)/i, "/staff") + search + hash} replace />;
}

/**
 * The app's router. Login and sign-up sit outside RootLayout because they need no session.
 * Staff (TSG and Secretary accounts alike) have one tree, `/staff/*`, with one page per tab. The IT Admin has its own,
 * `/it-admin/*`. The Lab Head, Custodian, and Director dashboards are still one component each, and the URL's last
 * segment picks the tab through `activeTab`.
 * Which role may open which tree is decided in RootLayout, not here.
 */
export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/loans/:loanId/accountability-form",
    Component: AccountabilityFormPage,
  },
  // A print page like the Accountability Form: no sidebar. The server decides who may open it (TSG only, 403 for anyone else).
  {
    path: "/staff/clearance/:userId",
    Component: ClearancePrintPage,
  },
  // A print page like the Accountability Form and the Clearance Record: no sidebar. The server decides who may open
  // it (TSG, the Director, the Secretary, or the asset's Lab Head; 403 for anyone else).
  {
    path: "/retirements/:retirementId/record",
    Component: DisposalRecordPrintPage,
  },
  { path: "/its/*", Component: OldStaffUrlRedirect },
  { path: "/tsg/*", Component: OldStaffUrlRedirect },
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },

      // Staff routes
      {
        path: "staff",
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview",    element: <OverviewPage /> },
          { path: "register",    element: <RegisterPage /> },
          { path: "inventory",   element: <InventoryPage /> },
          { path: "repairs",     element: <RepairsPage /> },
          { path: "inspections", element: <InspectionsPage /> },
          { path: "loans",       element: <LoansPage /> },
          { path: "returns",     element: <ReturnsPage /> },
          { path: "qrtags",      element: <QrTagsPage /> },
          { path: "analytics",   element: <HealthPage /> },
          { path: "health",      element: <Navigate to="/staff/analytics" replace /> },
          { path: "tickets",     element: <SupportTicketsPage /> },
          { path: "account",     element: <AccountDetailsPage /> },
        ],
      },

      // Lab Head routes
      {
        path: "lab-head",
        children: [
          { index: true, element: <Navigate to="custody" replace /> },
          { path: "custody",     element: <LabHeadDashboard activeTab="custody" /> },
          { path: "inventory",   element: <LabHeadDashboard activeTab="inventory" /> },
          { path: "health",      element: <LabHeadDashboard activeTab="health" /> },
          { path: "tickets",     element: <SupportTicketsPage /> },
          { path: "account",     element: <AccountDetailsPage /> },
        ],
      },

      // Custodian routes
      {
        path: "custodian",
        children: [
          { index: true, element: <Navigate to="myassets" replace /> },
          { path: "myassets",  element: <CustodianPortal activeTab="myassets" /> },
          { path: "myloans",   element: <CustodianPortal activeTab="myassets" /> },
          { path: "inventory", element: <Navigate to="myassets" replace /> },
          { path: "available", element: <CustodianPortal activeTab="available" /> },
          { path: "scan",      element: <CustodianPortal activeTab="scan" /> },
          { path: "report",    element: <CustodianPortal activeTab="report" /> },
          { path: "tickets",   element: <SupportTicketsPage /> },
          { path: "account",   element: <AccountDetailsPage /> },
        ],
      },

      // AdRIC Director routes
      {
        path: "adric-director",
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview",           element: <AdRICDirectorDashboard activeTab="overview" /> },
          { path: "inventory",          element: <InventoryPage readOnly /> },
          { path: "analytics",         element: <AdRICDirectorDashboard activeTab="analytics" /> },
          { path: "retirement-approvals", element: <AdRICDirectorDashboard activeTab="clearance-disposal" /> },
          { path: "clearance-disposal", element: <Navigate to="/adric-director/retirement-approvals" replace /> },
          { path: "reports",            element: <AdRICDirectorDashboard activeTab="reports" /> },
          { path: "tickets",            element: <SupportTicketsPage /> },
          { path: "account",            element: <AccountDetailsPage /> },
        ],
      },

      // IT Admin routes. Asset Inventory is the Director's read-only page: the IT Admin takes no asset steps there,
      // and deletes remarks from the asset modal.
      {
        path: "it-admin",
        children: [
          { index: true, element: <Navigate to="approvals" replace /> },
          { path: "approvals", element: <ApprovalsPage /> },
          { path: "users",     element: <UsersPage /> },
          { path: "inventory", element: <InventoryPage readOnly /> },
          { path: "activity-log", element: <ActivityLogPage /> },
          { path: "tickets",   element: <TicketsPage /> },
          { path: "account",   element: <AccountDetailsPage /> },
        ],
      },
    ],
  },
  { path: "*", Component: NotFound },
]);
