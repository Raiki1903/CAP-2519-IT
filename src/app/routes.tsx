import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { Login } from "@web/pages/auth/Login";
import { Register } from "@web/pages/auth/Register";
import { ITSDashboard } from "./components/ITSDashboard";
import { LabHeadDashboard } from "@web/pages/lab-head/LabHeadDashboard";
import { CustodianPortal } from "@web/pages/custodian/CustodianPortal";
import { AdRICDirectorDashboard } from "@web/pages/director/AdRICDirectorDashboard";
import { AccountDetailsPage } from "./components/AccountDetailsPage";
import { NotFound } from "./components/NotFound";

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

      // ITS routes
      {
        path: "its",
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview",    element: <ITSDashboard activeTab="overview" /> },
          { path: "register",    element: <ITSDashboard activeTab="register" /> },
          { path: "inventory",   element: <ITSDashboard activeTab="inventory" /> },
          { path: "repairs",     element: <ITSDashboard activeTab="repairs" /> },
          { path: "inspections", element: <ITSDashboard activeTab="inspections" /> },
          { path: "returns",     element: <ITSDashboard activeTab="returns" /> },
          { path: "qrtags",      element: <ITSDashboard activeTab="qrtags" /> },
          { path: "health",      element: <ITSDashboard activeTab="health" /> },
          { path: "account",     element: <AccountDetailsPage /> },
        ],
      },

      // TSG routes
      {
        path: "tsg",
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview",    element: <ITSDashboard activeTab="overview" /> },
          { path: "register",    element: <ITSDashboard activeTab="register" /> },
          { path: "inventory",   element: <ITSDashboard activeTab="inventory" /> },
          { path: "repairs",     element: <ITSDashboard activeTab="repairs" /> },
          { path: "inspections", element: <ITSDashboard activeTab="inspections" /> },
          { path: "returns",     element: <ITSDashboard activeTab="returns" /> },
          { path: "qrtags",      element: <ITSDashboard activeTab="qrtags" /> },
          { path: "health",      element: <ITSDashboard activeTab="health" /> },
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
