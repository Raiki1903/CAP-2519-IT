import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { Login } from "./components/Login";
import { ITSDashboard } from "./components/ITSDashboard";
import { TSGDashboard } from "./components/TSGDashboard";
import { LabHeadDashboard } from "./components/LabHeadDashboard";
import { CustodianPortal } from "./components/CustodianPortal";
import { AssetCatalog } from "./components/AssetCatalog";
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
          { path: "overview",   element: <ITSDashboard activeTab="overview" /> },
          { path: "register",   element: <ITSDashboard activeTab="register" /> },
          { path: "inventory",  element: <ITSDashboard activeTab="inventory" /> },
        ],
      },

      // TSG routes
      {
        path: "tsg",
        children: [
          { index: true, element: <Navigate to="maintenance" replace /> },
          { path: "maintenance", element: <TSGDashboard activeTab="maintenance" /> },
          { path: "qrtags",      element: <TSGDashboard activeTab="qrtags" /> },
          { path: "health",      element: <TSGDashboard activeTab="health" /> },
        ],
      },

      // Lab Head routes
      {
        path: "lab-head",
        children: [
          { index: true, element: <Navigate to="custody" replace /> },
          { path: "custody",     element: <LabHeadDashboard activeTab="custody" /> },
          { path: "delinquency", element: <LabHeadDashboard activeTab="delinquency" /> },
          { path: "inventory",   element: <LabHeadDashboard activeTab="inventory" /> },
          { path: "requests",    element: <LabHeadDashboard activeTab="requests" /> },
        ],
      },

      // Custodian routes
      {
        path: "custodian",
        children: [
          { index: true, element: <Navigate to="myassets" replace /> },
          { path: "myassets", element: <CustodianPortal activeTab="myassets" /> },
          { path: "browse",   element: <AssetCatalog /> },
          { path: "scan",     element: <CustodianPortal activeTab="scan" /> },
          { path: "report",   element: <CustodianPortal activeTab="report" /> },
        ],
      },
    ],
  },
  { path: "*", Component: NotFound },
]);
