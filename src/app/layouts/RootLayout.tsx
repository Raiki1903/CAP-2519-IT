import { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useSession, roleToSlug, roleDefaultPath } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { Sidebar } from "../components/Sidebar";
import { NotificationCenter } from "../components/NotificationCenter";
import { Menu, Shield } from "lucide-react";

export function RootLayout() {
  const { role, setRole, currentUser } = useSession();
  const { isDbLoading } = useServerData();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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
    <div className="flex flex-col md:flex-row h-screen overflow-hidden relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top-Edge Progress Bar UI */}
      {isDbLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-emerald-950/40 overflow-hidden">
          <div className="h-full bg-emerald-500 w-full animate-pulse transition-all duration-300 shadow-[0_0_8px_#10B981]" />
        </div>
      )}
      {/* Mobile Top Header */}
      <div className="flex md:hidden items-center justify-between bg-[#0A1F14] border-b border-emerald-950/20 px-4 py-3 h-14 w-full text-white z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1 text-[#4ADE80] hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-600">
              <Shield size={12} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-white text-[10px] font-extrabold tracking-wide uppercase" style={{ fontFamily: "'Montserrat', sans-serif" }}>EquipmentMS</p>
              <p className="text-[7px] font-semibold tracking-[1px] text-[#34D399]">DLSU AdRIC</p>
            </div>
          </div>
        </div>
        
        {/* Quick user details & link to account */}
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] font-bold bg-emerald-950/40 text-emerald-300 border border-emerald-500/10 px-2 py-0.5 rounded uppercase">
            {role === "AdRICDirector" ? "Director" :
             role === "Custodian" ? "Custodian" :
             role === "ITS" ? "ITS" :
             role === "TSG" ? "TSG" :
             role === "LabHead" ? "Lab Head" : role}
          </span>
          <button
            onClick={() => navigate(`/${slug}/account`)}
            className="w-7 h-7 rounded-full border border-emerald-400 overflow-hidden cursor-pointer focus:outline-none"
            aria-label="Go to account settings"
          >
            <img
              src={currentUser?.profilePicture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150"}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>

      <Sidebar 
        onLogout={() => setRole(null)} 
        isMobileOpen={isMobileOpen} 
        onCloseMobile={() => setIsMobileOpen(false)} 
      />

      {/* Backdrop overlay for mobile menu */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden cursor-pointer animate-fadeIn"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main content — shifting green/white animated background */}
      <main
        className="dashboard-bg flex-1 overflow-auto"
        style={{ minWidth: 0 }}
      >
        <div className="min-h-full p-4 sm:p-7">
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

      {/* Unified floating Notification Center widget */}
      <NotificationCenter />
    </div>
  );
}
