import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { Login } from "./components/Login";
import { ITSDashboard } from "./components/ITSDashboard";
import { LabHeadDashboard } from "./components/LabHeadDashboard";
import { CustodianPortal } from "./components/CustodianPortal";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
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
        ],
      },

      // Custodian routes
      {
        path: "custodian",
        children: [
          { index: true, element: <Navigate to="myassets" replace /> },
          { path: "myassets",  element: <CustodianPortal activeTab="myassets" /> },
          { path: "available", element: <CustodianPortal activeTab="available" /> },
          { path: "scan",      element: <CustodianPortal activeTab="scan" /> },
          { path: "report",    element: <CustodianPortal activeTab="report" /> },
        ],
      },
    ],
  },
  { path: "*", Component: NotFound },
]);
