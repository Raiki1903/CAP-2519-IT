import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, LogOut, Monitor, Users, Wrench, QrCode,
  BarChart3, ClipboardList, Bell, Package, AlertTriangle,
  ChevronsLeft, ChevronsRight, ClipboardCheck, Settings
} from "lucide-react";
import { useApp, roleToSlug, type Role, getCookie } from "../context";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { cn } from "./ui/utils";

const COLLAPSED_W = 64;
const EXPANDED_W  = 240;

const roleConfig: Record<Role, {
  label: string;
  subtitle: string;
  nav: { id: string; label: string; icon: React.ElementType }[];
}> = {
  ITS: {
    label: "Information Technology Services",
    subtitle: "ITS · System Administration",
    nav: [
      { id: "overview",    label: "System Overview",      icon: Monitor       },
      { id: "register",    label: "Register Equipment",   icon: Package       },
      { id: "inventory",   label: "Asset Inventory",      icon: ClipboardList },
      { id: "repairs",     label: "Repair Manager",       icon: Wrench        },
      { id: "inspections", label: "Inspection Manager",   icon: ClipboardCheck },
      { id: "returns",     label: "Pending Returns",       icon: ClipboardList },
      { id: "qrtags",      label: "QR Tag Wizard",         icon: QrCode        },
      { id: "health",      label: "Health Benchmarking",   icon: BarChart3     },
    ],
  },
  TSG: {
    label: "Technical Support Group",
    subtitle: "TSG · Asset Maintenance",
    nav: [
      { id: "overview",    label: "System Overview",      icon: Monitor       },
      { id: "register",    label: "Register Equipment",   icon: Package       },
      { id: "inventory",   label: "Asset Inventory",      icon: ClipboardList },
      { id: "repairs",     label: "Repair Manager",       icon: Wrench        },
      { id: "inspections", label: "Inspection Manager",   icon: ClipboardCheck },
      { id: "returns",     label: "Pending Returns",       icon: ClipboardList },
      { id: "qrtags",      label: "QR Tag Wizard",         icon: QrCode        },
      { id: "health",      label: "Health Benchmarking",   icon: BarChart3     },
    ],
  },
  LabHead: {
    label: "Lab Head / Project Leader",
    subtitle: "Command Suite",
    nav: [
      { id: "custody",     label: "Custody Transitions", icon: Users         },
      { id: "inventory",   label: "Branch Inventory",    icon: ClipboardList },
      { id: "health",      label: "Health Benchmarking",   icon: BarChart3     },
    ],
  },
  Custodian: {
    label: "Active Custodian",
    subtitle: "Borrower Micro-Portal",
    nav: [
      { id: "myassets",  label: "My Assets",           icon: Package },
      { id: "available", label: "Available Equipment", icon: Monitor },
      { id: "scan",      label: "QR Scan",             icon: QrCode  },
      { id: "report",    label: "Report Issue",        icon: Bell    },
    ],
  },
};

export function Sidebar({ onLogout }: { onLogout: () => void }) {
  const { role, unacknowledgedCount, sidebarCollapsed, setSidebarCollapsed, cycleMode, setCycleMode, theme, setTheme } = useApp();
  const [showSettings, setShowSettings] = useState(false);
  const navigate   = useNavigate();
  const location   = useLocation();

  if (!role) return null;

  const cfg        = roleConfig[role];
  const slug       = roleToSlug[role];
  const activeTab  = location.pathname.split("/").pop() ?? "";
  const collapsed  = sidebarCollapsed;

  return (
    <TooltipProvider delayDuration={150}>
      <motion.aside
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-col h-full flex-shrink-0 overflow-hidden"
        style={{ background: "#0A1F14", borderRight: "1px solid rgba(16,185,129,0.12)" }}
      >
        {/* ── Top: brand + collapse toggle ─────────────────────────────── */}
        <div
          className="flex items-center justify-between px-3 pt-4 pb-3"
          style={{ borderBottom: "1px solid rgba(16,185,129,0.15)", minHeight: 68 }}
        >
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2.5 overflow-hidden"
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary">
                  <Shield size={14} className="text-primary-foreground" />
                </div>
                <div className="leading-tight overflow-hidden">
                  <p className="text-white text-[11px] font-extrabold tracking-wide truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>EquipmentMS</p>
                  <p className="text-[8px] font-semibold tracking-[2px]" style={{ color: "#34D399" }}>DLSU AdRIC</p>
                </div>
              </motion.div>
            )}

            {collapsed && (
              <motion.div
                key="brand-icon"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
                className="mx-auto"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary">
                  <Shield size={15} className="text-primary-foreground" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarCollapsed(!collapsed)}
                className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                  "text-[#4ADE80] hover:bg-white/10",
                  collapsed && "mx-auto"
                )}
              >
                {collapsed
                  ? <ChevronsRight size={13} />
                  : <ChevronsLeft  size={13} />
                }
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Session badge ─────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="session"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="mx-3 mt-3 rounded-lg p-2.5" style={{ background: "rgba(0,90,54,0.4)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <p className="text-[8px] font-bold tracking-[2px] mb-0.5" style={{ color: "#6EE7B7" }}>ACTIVE SESSION</p>
                <p className="text-[11px] font-semibold text-white leading-snug" style={{ fontFamily: "'Montserrat', sans-serif" }}>{cfg.label}</p>
                <p className="text-[8px] mt-0.5" style={{ color: "#34D399" }}>{cfg.subtitle}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigation ────────────────────────────────────────────────── */}
        <nav className="flex-1 px-2 pt-3 pb-1">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                key="nav-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[8px] font-bold tracking-[2px] px-2 pb-1.5 pt-1"
                style={{ color: "#4ADE80" }}
              >
                NAVIGATION
              </motion.p>
            )}
          </AnimatePresence>

          {cfg.nav.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const alertCount = id === "repairs" ? unacknowledgedCount : 0;
            const hasAlert   = alertCount > 0;

            const navBtn = (
              <motion.button
                key={id}
                whileHover={{ x: collapsed ? 0 : 3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/${slug}/${id}`)}
                className={cn(
                  "w-full flex items-center rounded-lg mb-0.5 transition-colors",
                  collapsed ? "justify-center h-10" : "gap-2.5 h-9 px-2.5",
                  "border-l-[3px]",
                  active
                    ? "bg-[rgba(0,90,54,0.55)] border-l-[#10B981]"
                    : "border-l-transparent hover:bg-white/5"
                )}
              >
                <motion.span
                  animate={{ color: active ? "#34D399" : "#6B7280" }}
                  transition={{ duration: 0.15 }}
                  className="flex-shrink-0"
                >
                  <Icon size={collapsed ? 17 : 15} />
                </motion.span>

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.18 }}
                      className={cn(
                        "flex-1 text-left text-[12px] truncate overflow-hidden whitespace-nowrap",
                        active ? "text-white font-semibold" : "text-[#9CA3AF]"
                      )}
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {!collapsed && hasAlert && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="badge-pulse bg-destructive text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  >
                    {alertCount}
                  </motion.span>
                )}

                {collapsed && hasAlert && (
                  <span className="badge-pulse absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </motion.button>
            );

            return collapsed ? (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <div className="relative">{navBtn}</div>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex items-center gap-2">
                  {label}
                  {hasAlert && <span className="badge-pulse bg-red-500 text-white text-[9px] font-bold px-1.5 rounded-full">{alertCount}</span>}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div key={id}>{navBtn}</div>
            );
          })}
        </nav>

        {/* ── Route pill (expanded only) ─────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="route"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-3 pb-1 overflow-hidden"
            >
              <div className="rounded-lg px-3 py-1.5" style={{ background: "rgba(0,0,0,0.2)" }}>
                <p className="text-[8px] font-semibold tracking-wide" style={{ color: "#4B5563" }}>CURRENT ROUTE</p>
                <p className="font-mono text-[9px] truncate" style={{ color: "#34D399" }}>{location.pathname}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Separator style={{ background: "rgba(16,185,129,0.12)" }} />

        {/* ── System status + logout ────────────────────────────────────── */}
        <div className="p-3 space-y-2">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="status"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="rounded-lg p-2.5 mb-2" style={{ background: "rgba(0,0,0,0.25)" }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[8px] font-bold tracking-[1.5px]" style={{ color: "#4ADE80" }}>SYSTEM STATUS</span>
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                    />
                  </div>
                  <p className="text-[10px]" style={{ color: "#6EE7B7" }}>All services operational</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "#4B5563" }}>Last sync: 2 min ago</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preferences Settings Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <Button
                  variant="outline"
                  size={collapsed ? "icon" : "sm"}
                  onClick={() => setShowSettings(true)}
                  className={cn(
                    "border-emerald-900/40 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200",
                    collapsed ? "w-full" : "w-full text-[11px]"
                  )}
                >
                  <Settings size={12} />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden whitespace-nowrap ml-2"
                      >
                        Preferences
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Preferences</TooltipContent>}
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <Button
                  variant="outline"
                  size={collapsed ? "icon" : "sm"}
                  onClick={onLogout}
                  className={cn(
                    "border-red-900/40 bg-red-950/20 text-red-300 hover:bg-red-950/40 hover:text-red-200",
                    collapsed ? "w-full" : "w-full text-[11px]"
                  )}
                >
                  <LogOut size={12} />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        Sign Out
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Sign Out</TooltipContent>}
          </Tooltip>
        </div>
      </motion.aside>

      {/* ── Settings Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl text-slate-100"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              <div className="h-1.5 bg-[#005A36]" />
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <Settings size={18} className="text-emerald-400" />
                    System Preferences &amp; Session
                  </h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <LogOut size={16} className="rotate-180" />
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Theme Option */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Interface Theme</p>
                      <p className="text-[10px] text-slate-400">Toggle classic dark or light slate</p>
                    </div>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as any)}
                      className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 text-white"
                    >
                      <option value="classic-dark">Classic Dark</option>
                      <option value="light-slate">Light Slate</option>
                    </select>
                  </div>

                  {/* Cycle Mode Option */}
                  <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-white/5">
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider">Active Inspection Cycle</p>
                      <p className="text-[10px] text-slate-400">Term-based or Annual schedules</p>
                    </div>
                    <select
                      value={cycleMode}
                      onChange={(e) => setCycleMode(e.target.value as any)}
                      className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 text-white"
                    >
                      <option value="Trimestral">Trimestral Cycle</option>
                      <option value="Annual">Annual Cycle</option>
                    </select>
                  </div>

                  {/* Session Information */}
                  <div className="p-4 bg-[#0A1F14] border border-emerald-500/10 rounded-xl space-y-2.5">
                    <p className="text-[10px] font-extrabold text-emerald-400 tracking-wider uppercase">Active Session Details</p>
                    
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Authorized User:</span>
                        <span className="font-semibold text-white truncate max-w-[200px]" title={getCookie("session_user_email") || "guest@dlsu.edu.ph"}>
                          {getCookie("session_user_email") || "guest@dlsu.edu.ph"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Role Context:</span>
                        <span className="font-semibold text-white">{role}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Session Created:</span>
                        <span className="font-mono text-slate-300">
                          {getCookie("session_created") ? new Date(parseInt(getCookie("session_created")!, 10)).toLocaleString() : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last Activity:</span>
                        <span className="font-mono text-slate-300">
                          {getCookie("session_last_activity") ? new Date(parseInt(getCookie("session_last_activity")!, 10)).toLocaleString() : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-500/15 pt-2 mt-2">
                        <span className="text-slate-400 font-medium">Session Policy:</span>
                        <span className="text-emerald-300 font-semibold text-[10px] uppercase">24h Decay / 30d Refresh</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setShowSettings(false)} className="bg-[#005A36] hover:bg-[#004225] text-white text-xs">
                    Save &amp; Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
