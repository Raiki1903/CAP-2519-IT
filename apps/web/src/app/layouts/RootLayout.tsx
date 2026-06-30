import { Outlet, Navigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useApp, roleToSlug, roleDefaultPath } from "../context";
import { Sidebar } from "../components/Sidebar";

export function RootLayout() {
  const { role, setRole } = useApp();
  const location = useLocation();

  if (!role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const slug = roleToSlug[role];
  const isAtRoot = location.pathname === "/";
  const isOnWrongSection =
    !isAtRoot && !location.pathname.startsWith(`/${slug}`);

  if (isAtRoot || isOnWrongSection) {
    return <Navigate to={roleDefaultPath[role]} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar onLogout={() => setRole(null)} />

      {/* Main content — shifting green/white animated background */}
      <main
        className="dashboard-bg flex-1 overflow-auto"
        style={{ minWidth: 0 }}
      >
        <div className="min-h-full p-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
