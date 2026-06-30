import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, LogOut, Monitor, Users, Wrench, QrCode,
  BarChart3, ClipboardList, Bell, Package, AlertTriangle,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { useApp, roleToSlug, type Role } from "../context";
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
      { id: "maintenance", label: "Maintenance Manager",   icon: Wrench        },
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
      { id: "maintenance", label: "Maintenance Manager",   icon: Wrench        },
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
  const { role, unacknowledgedCount, sidebarCollapsed, setSidebarCollapsed } = useApp();
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
            const alertCount = id === "maintenance" ? unacknowledgedCount : 0;
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
    </TooltipProvider>
  );
}
