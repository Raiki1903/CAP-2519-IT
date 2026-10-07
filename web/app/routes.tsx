/**
 * Route table: which URL shows which screen, one tree per role under RootLayout.
 * Layer: shared (app shell). Called by app/App.tsx.
 * Calls: the screens in web/pages/, and src/app/components/ITSDashboard.tsx for ITS and TSG.
 * Used by: every role.
 */
import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { Login } from "@web/pages/auth/Login";
import { Register } from "@web/pages/auth/Register";
import { ITSDashboard } from "@/app/components/ITSDashboard";
import { OverviewPage } from "@web/pages/staff/OverviewPage";
import { RegisterPage } from "@web/pages/staff/RegisterPage";
import { InventoryPage } from "@web/pages/staff/InventoryPage";
import { LabHeadDashboard } from "@web/pages/lab-head/LabHeadDashboard";
import { CustodianPortal } from "@web/pages/custodian/CustodianPortal";
import { AdRICDirectorDashboard } from "@web/pages/director/AdRICDirectorDashboard";
import { AccountDetailsPage } from "@web/pages/AccountDetailsPage";
import { NotFound } from "@web/pages/NotFound";

/**
 * The app's router. Login and sign-up sit outside RootLayout because they need no session.
 * Each dashboard is one component, and the URL's last segment picks its tab through `activeTab`.
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
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },

      // ITS routes. Each tab has its own key, so switching tabs starts that tab
      // fresh instead of reusing the previous tab's component and its state.
      {
        path: "its",
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview",    element: <OverviewPage /> },
          { path: "register",    element: <RegisterPage /> },
          { path: "inventory",   element: <InventoryPage /> },
          { path: "repairs",     element: <ITSDashboard key="repairs" activeTab="repairs" /> },
          { path: "inspections", element: <ITSDashboard key="inspections" activeTab="inspections" /> },
          { path: "returns",     element: <ITSDashboard key="returns" activeTab="returns" /> },
          { path: "qrtags",      element: <ITSDashboard key="qrtags" activeTab="qrtags" /> },
          { path: "health",      element: <ITSDashboard key="health" activeTab="health" /> },
          { path: "account",     element: <AccountDetailsPage /> },
        ],
      },

      // TSG routes
      {
        path: "tsg",
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview",    element: <OverviewPage /> },
          { path: "register",    element: <RegisterPage /> },
          { path: "inventory",   element: <InventoryPage /> },
          { path: "repairs",     element: <ITSDashboard key="repairs" activeTab="repairs" /> },
          { path: "inspections", element: <ITSDashboard key="inspections" activeTab="inspections" /> },
          { path: "returns",     element: <ITSDashboard key="returns" activeTab="returns" /> },
          { path: "qrtags",      element: <ITSDashboard key="qrtags" activeTab="qrtags" /> },
          { path: "health",      element: <ITSDashboard key="health" activeTab="health" /> },
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
          { path: "approvals",   element: <LabHeadDashboard activeTab="approvals" /> },
          { path: "account",     element: <AccountDetailsPage /> },
        ],
      },

      // Custodian routes
      {
        path: "custodian",
        children: [
          { index: true, element: <Navigate to="myassets" replace /> },
          { path: "myassets",  element: <CustodianPortal activeTab="myassets" /> },
          { path: "inventory", element: <Navigate to="myassets" replace /> },
          { path: "available", element: <CustodianPortal activeTab="available" /> },
          { path: "scan",      element: <CustodianPortal activeTab="scan" /> },
          { path: "report",    element: <CustodianPortal activeTab="report" /> },
          { path: "account",   element: <AccountDetailsPage /> },
        ],
      },

      // AdRIC Director routes
      {
        path: "adric-director",
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview",           element: <AdRICDirectorDashboard activeTab="overview" /> },
          { path: "analytics",          element: <AdRICDirectorDashboard activeTab="analytics" /> },
          { path: "clearance-disposal", element: <AdRICDirectorDashboard activeTab="clearance-disposal" /> },
          { path: "reports",            element: <AdRICDirectorDashboard activeTab="reports" /> },
          { path: "account",            element: <AccountDetailsPage /> },
        ],
      },
    ],
  },
  { path: "*", Component: NotFound },
]);
