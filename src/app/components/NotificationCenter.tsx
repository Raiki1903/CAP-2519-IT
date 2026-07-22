import { useState, useEffect, useRef } from "react";
import { useApp, getCookie } from "../context";
import { prisma } from "../prismaClient";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Wrench,
  ArrowLeftRight,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  UserX,
  Trash2,
  CheckCircle,
  X,
  Clock,
  Activity,
  UserCheck,
  Info
} from "lucide-react";

export function NotificationCenter() {
  const {
    role,
    assets,
    repairRequests,
    transfers,
    returns,
    pendingDisposals,
    manualClearanceHolds,
    acknowledgeRepair,
    updateTransferRequest,
    approveDisposal,
    rejectDisposal,
    currentUser
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"requests" | "reminders" | "holds">("requests");
  const currentUserName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "A. Dela Cruz (Active Custodian)";
  const currentUserEmail = currentUser?.email || "";
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!role) return null;

  // ────────────────────────────────────────────────────────────────────────────
  // Calculate Dynamic Notifications List
  // ────────────────────────────────────────────────────────────────────────────

  // 1. CLEARANCE HOLDS
  const holdsList: { id: string; name: string; email: string; userRole: string; notes: string; isSystem: boolean; needsAction: boolean }[] = [];
  
  // Add manual holds
  manualClearanceHolds.forEach(h => {
    if (h.holdStatus === "Hold Active") {
      holdsList.push({
        id: `HOLD-M-${h.userId}`,
        name: h.name,
        email: h.email,
        userRole: h.role,
        notes: h.notes || "Manual clearance hold activated.",
        isSystem: false,
        needsAction: role === "AdRICDirector" || (role === "Custodian" && h.name === currentUserName)
      });
    }
  });

  // Calculate system-flagged holds for overdue users
  const uniqueCustodiansWithOverdue = Array.from(
    new Set(assets.filter(a => a.custodian && a.status === "Overdue").map(a => a.custodian))
  );

  uniqueCustodiansWithOverdue.forEach((custName, idx) => {
    if (custName && !holdsList.some(h => h.name === custName)) {
      const isFaculty = custName === "Felix Torres" || custName.startsWith("Dr.");
      holdsList.push({
        id: `HOLD-S-${idx + 4}`,
        name: custName,
        email: `${custName.toLowerCase().replace(/\s/g, "")}@dlsu.edu.ph`,
        userRole: isFaculty ? "Faculty" : "Student",
        notes: "System-Flagged: Overdue equipment delinquency.",
        isSystem: true,
        needsAction: role === "AdRICDirector" || (role === "Custodian" && custName === currentUserName)
      });
    }
  });

  const hasPersonalHold = holdsList.some(h => h.name === currentUserName);
  const personalHoldNotes = holdsList.find(h => h.name === currentUserName)?.notes;

  // 2. REQUESTS (Repairs, Transfers, Returns, Disposals)
  const requestsList: {
    id: string;
    type: "repair" | "transfer" | "return" | "disposal";
    title: string;
    description: string;
    date: string;
    priority?: string;
    needsAction: boolean;
    meta: any;
  }[] = [];

  // A. Repairs
  repairRequests.forEach(rep => {
    const isOverdueOrActive = rep.statusLabel !== "Fixed & Completed";
    if (isOverdueOrActive) {
      let isRelevant = false;
      let actionRequired = false;

      if (role === "ITS" || role === "TSG" || role === "AdRICDirector") {
        isRelevant = true;
        actionRequired = !rep.acknowledged; // Needs acknowledgement
      } else if (role === "LabHead") {
        const asset = assets.find(a => a.id === rep.assetId);
        if (asset?.lab === "CITe4D") {
          isRelevant = true;
        }
      } else if (role === "Custodian") {
        if (rep.custodian === currentUserName) {
          isRelevant = true;
        }
      }

      if (isRelevant) {
        requestsList.push({
          id: rep.id,
          type: "repair",
          title: `Repair Request: ${rep.assetName}`,
          description: `Reported by ${rep.custodian}: "${rep.description}" (Priority: ${rep.priority})`,
          date: rep.submittedAt,
          priority: rep.priority,
          needsAction: actionRequired,
          meta: rep
        });
      }
    }
  });

  // B. Transfers
  transfers.forEach(txn => {
    if (txn.status === "Pending") {
      let isRelevant = false;
      let actionRequired = false;

      if (role === "ITS" || role === "TSG") {
        isRelevant = true;
        actionRequired = true; // Can approve
      } else if (role === "LabHead" && txn.lab === "CITe4D") {
        isRelevant = true;
        actionRequired = true; // Can authorize
      } else if (role === "Custodian" && (txn.from === currentUserName || txn.to === currentUserName)) {
        isRelevant = true;
      } else if (role === "AdRICDirector") {
        isRelevant = true;
      }

      if (isRelevant) {
        requestsList.push({
          id: txn.id,
          type: "transfer",
          title: `Custody Transfer: ${txn.asset}`,
          description: `Transfer initiated from ${txn.from} to ${txn.to} in Lab ${txn.lab}`,
          date: txn.initiated,
          needsAction: actionRequired,
          meta: txn
        });
      }
    }
  });

  // C. Returns
  returns.forEach(ret => {
    if (ret.status === "Pending") {
      let isRelevant = false;
      let actionRequired = false;

      const asset = assets.find(a => a.id === ret.assetId);
      const isMyLab = asset?.lab === "CITe4D";

      if (role === "ITS" || role === "TSG") {
        isRelevant = true;
        actionRequired = true; // Can finalize inspection
      } else if (role === "LabHead") {
        if (isMyLab) {
          isRelevant = true;
          actionRequired = true; // Can inspect
        }
      } else if (role === "Custodian" && ret.custodian === currentUserName) {
        isRelevant = true;
      } else if (role === "AdRICDirector") {
        isRelevant = true;
      }

      if (isRelevant) {
        requestsList.push({
          id: ret.id,
          type: "return",
          title: `Return Request: ${ret.assetName}`,
          description: `Returned by custodian ${ret.custodian}. Awaiting final condition check & clearance.`,
          date: ret.returnDate,
          needsAction: actionRequired,
          meta: { ...ret, asset }
        });
      }
    }
  });

  // D. Disposals (AdRIC Director Approvals)
  pendingDisposals.forEach(disp => {
    let isRelevant = false;
    let actionRequired = false;

    if (role === "AdRICDirector") {
      isRelevant = true;
      actionRequired = true; // Director authorized sign-off
    } else if (role === "ITS" || role === "TSG") {
      isRelevant = true; // Track proposed disposals
    }

    if (isRelevant) {
      requestsList.push({
        id: disp.id,
        type: "disposal",
        title: `Asset Disposal Approval: ${disp.assetName}`,
        description: `Decommission request: "${disp.breakdownReasons}". Pathway: ${disp.disposalPathway}. Requested by: ${disp.requestedBy}.`,
        date: disp.requestedAt,
        needsAction: actionRequired,
        meta: disp
      });
    }
  });

  // Sort requests by newest/priority
  requestsList.sort((a, b) => {
    if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // 3. REMINDERS (Overdue Returns, Due Soon, Degraded Health)
  const remindersList: {
    id: string;
    type: "overdue" | "duesoon" | "degraded";
    title: string;
    description: string;
    date?: string;
    needsAction: boolean;
    meta: any;
  }[] = [];

  assets.forEach(asset => {
    const isOverdue = asset.status === "Overdue" || (asset.daysLeft !== undefined && asset.daysLeft < 0);
    const isDueSoon = asset.daysLeft !== undefined && asset.daysLeft >= 0 && asset.daysLeft <= 5;
    const isDegraded = asset.condition <= 60 && asset.status !== "Disposed";

    const isMyAsset = asset.custodian === currentUserName;
    const isMyLab = asset.lab === "CITe4D";

    // A. Overdue Asset
    if (isOverdue) {
      let isRelevant = role === "ITS" || role === "TSG" || role === "AdRICDirector" || (role === "LabHead" && isMyLab) || (role === "Custodian" && isMyAsset);
      if (isRelevant) {
        remindersList.push({
          id: `REM-OVD-${asset.id}`,
          type: "overdue",
          title: `Overdue Equipment Return: ${asset.name}`,
          description: isMyAsset
            ? `WARNING: This device was due on ${asset.dueDate}. Return it immediately to avoid registration/clearance holds.`
            : `Custodian ${asset.custodian || "Unknown"} is overdue returning this device (Due: ${asset.dueDate}).`,
          needsAction: isMyAsset || (role === "LabHead" && isMyLab),
          meta: asset
        });
      }
    }

    // B. Due Soon
    if (isDueSoon) {
      let isRelevant = (role === "Custodian" && isMyAsset) || (role === "LabHead" && isMyLab);
      if (isRelevant) {
        remindersList.push({
          id: `REM-DUE-${asset.id}`,
          type: "duesoon",
          title: `Return Reminder: ${asset.name}`,
          description: isMyAsset
            ? `Your borrowed device is due in ${asset.daysLeft} days (on ${asset.dueDate}).`
            : `Device held by ${asset.custodian} is due in ${asset.daysLeft} days.`,
          needsAction: isMyAsset,
          meta: asset
        });
      }
    }

    // C. Degraded Condition
    if (isDegraded) {
      let isRelevant = role === "ITS" || role === "TSG" || (role === "LabHead" && isMyLab);
      if (isRelevant) {
        remindersList.push({
          id: `REM-DEG-${asset.id}`,
          type: "degraded",
          title: `Degraded Health Alert: ${asset.name}`,
          description: `Device condition is at ${asset.condition}% in lab ${asset.lab}. Technical inspection recommended.`,
          needsAction: role === "TSG" || (role === "LabHead" && isMyLab),
          meta: asset
        });
      }
    }
  });

  // Sort reminders: Overdue first, then needsAction
  remindersList.sort((a, b) => {
    if (a.type === "overdue" && b.type !== "overdue") return -1;
    if (b.type === "overdue" && a.type !== "overdue") return 1;
    return a.needsAction ? -1 : 1;
  });

  // Calculate overall action needed badge count
  const requestsBadge = requestsList.filter(r => r.needsAction).length;
  const remindersBadge = remindersList.filter(r => r.needsAction).length;
  const holdsBadge = holdsList.filter(h => h.needsAction).length;
  const totalBadgeCount = requestsBadge + remindersBadge + holdsBadge;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-14 h-14 rounded-full text-white shadow-2xl transition-all duration-300 focus:outline-none hover:scale-105 active:scale-95 cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #005A36 0%, #10B981 100%)",
          boxShadow: isOpen 
            ? "0 10px 25px -5px rgba(0, 90, 54, 0.4), 0 0 12px rgba(16, 185, 129, 0.3)" 
            : "0 8px 20px -6px rgba(0, 0, 0, 0.3)"
        }}
      >
        {isOpen ? <X size={22} /> : <Bell size={22} />}
        
        {totalBadgeCount > 0 && !isOpen && (
          <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 border-2 border-white text-[10px] font-bold text-white shadow-md animate-pulse">
            {totalBadgeCount}
          </span>
        )}
      </button>

      {/* Slide-out Flyout Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-16 right-0 w-[420px] max-h-[580px] rounded-2xl border flex flex-col shadow-2xl overflow-hidden backdrop-blur-md"
            style={{
              backgroundColor: "var(--card, #ffffff)",
              borderColor: "var(--border, #E5E7EB)",
              color: "var(--card-foreground, #0f172a)"
            }}
          >
            {/* Top Color Accent Bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#005A36] to-[#10B981]" />

            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
              <div>
                <h3 className="text-sm font-bold tracking-tight">Notification Center</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Logged in: <span className="font-semibold text-primary">{currentUserName}</span> ({role})
                </p>
              </div>
              <span className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold">
                {totalBadgeCount} Action Required
              </span>
            </div>

            {/* Warning Banner if current Custodian has clearance hold */}
            {role === "Custodian" && hasPersonalHold && (
              <div className="bg-red-50 border-b border-red-150 px-5 py-2.5 flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-extrabold text-red-800">Clearance Hold Active</p>
                  <p className="text-[10px] text-red-700 leading-normal">{personalHoldNotes || "System hold due to overdue equipment."}</p>
                </div>
              </div>
            )}

            {/* Tabs List */}
            <div className="flex border-b border-border text-xs font-semibold bg-slate-50/30 dark:bg-slate-900/5">
              {[
                { id: "requests", label: "Requests", badge: requestsBadge },
                { id: "reminders", label: "Reminders", badge: remindersBadge },
                { id: "holds", label: "Clearance Holds", badge: holdsBadge }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-center border-b-2 transition-all relative cursor-pointer ${
                    activeTab === tab.id
                      ? "border-primary text-primary font-bold"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50/20"
                  }`}
                >
                  {tab.label}
                  {tab.badge > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[9px] font-bold">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable Notifications Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[360px] min-h-[220px]">
              
              {/* REQUESTS TAB */}
              {activeTab === "requests" && (
                <>
                  {requestsList.map(item => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                        item.needsAction
                          ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-300/40 shadow-sm"
                          : "bg-card border-border/80"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 justify-between">
                        <div className="flex items-start gap-2">
                          <span className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                            item.type === "repair" ? "bg-red-50 dark:bg-red-950/20 text-red-600" :
                            item.type === "transfer" ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600" :
                            item.type === "return" ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" :
                            "bg-purple-50 dark:bg-purple-950/20 text-purple-600"
                          }`}>
                            {item.type === "repair" && <Wrench size={14} />}
                            {item.type === "transfer" && <ArrowLeftRight size={14} />}
                            {item.type === "return" && <ClipboardCheck size={14} />}
                            {item.type === "disposal" && <Trash2 size={14} />}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold leading-tight">{item.title}</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">{item.description}</p>
                          </div>
                        </div>
                        {item.needsAction && (
                          <span className="flex-shrink-0 text-[8px] bg-red-600 text-white font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider animate-pulse">
                            Action
                          </span>
                        )}
                      </div>

                      {/* Dynamic Inline Action Controls */}
                      {item.needsAction && (
                        <div className="flex items-center justify-end gap-1.5 border-t border-dashed border-border/60 pt-2 mt-1">
                          
                          {/* Acknowledge Repair Button */}
                          {item.type === "repair" && (role === "ITS" || role === "TSG") && (
                            <button
                              onClick={async () => {
                                await acknowledgeRepair(item.id);
                              }}
                              className="text-[10px] font-bold text-white bg-primary hover:bg-primary/90 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle size={10} /> Acknowledge
                            </button>
                          )}

                          {/* Authorize Custody Transfer Buttons */}
                          {item.type === "transfer" && (
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  await updateTransferRequest(item.id, "Approved");
                                }}
                                className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  await updateTransferRequest(item.id, "Declined");
                                }}
                                className="text-[10px] font-bold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          )}

                          {/* Authorize Decommission Disposal Buttons */}
                          {item.type === "disposal" && role === "AdRICDirector" && (
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  await approveDisposal(item.id);
                                }}
                                className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Authorize
                              </button>
                              <button
                                onClick={async () => {
                                  await rejectDisposal(item.id);
                                }}
                                className="text-[10px] font-bold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {item.type === "return" && (
                            <p className="text-[9px] text-muted-foreground italic">Go to Pending Returns tab to inspect</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {requestsList.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                      <CheckCircle size={28} className="text-emerald-500/50 mb-2" />
                      <p className="text-xs font-semibold text-foreground">No Pending Requests</p>
                      <p className="text-[10px] mt-0.5">All repair, transfer, and return requests are up to date.</p>
                    </div>
                  )}
                </>
              )}

              {/* REMINDERS TAB */}
              {activeTab === "reminders" && (
                <>
                  {remindersList.map(item => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                        item.needsAction
                          ? "bg-red-50/20 dark:bg-red-950/10 border-red-300/30"
                          : "bg-card border-border/80"
                      }`}
                    >
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex items-start gap-2.5">
                          <span className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                            item.type === "overdue" ? "bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-100" :
                            item.type === "duesoon" ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600" :
                            "bg-orange-50 dark:bg-orange-950/20 text-orange-600"
                          }`}>
                            {item.type === "overdue" && <AlertTriangle size={14} />}
                            {item.type === "duesoon" && <Clock size={14} />}
                            {item.type === "degraded" && <Activity size={14} />}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold leading-tight">{item.title}</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {remindersList.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                      <CheckCircle size={28} className="text-emerald-500/50 mb-2" />
                      <p className="text-xs font-semibold text-foreground">No Active Reminders</p>
                      <p className="text-[10px] mt-0.5">No overdue assets or low-health equipment detected.</p>
                    </div>
                  )}
                </>
              )}

              {/* CLEARANCE HOLDS TAB */}
              {activeTab === "holds" && (
                <>
                  {holdsList.map(item => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border bg-card border-border/80 transition-all flex flex-col gap-2 ${
                        item.name === currentUserName ? "border-red-400 bg-red-50/10" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2.5 justify-between">
                        <div className="flex items-start gap-2">
                          <span className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 flex-shrink-0 mt-0.5">
                            <UserX size={14} />
                          </span>
                          <div>
                            <h4 className="text-xs font-bold leading-tight">
                              {item.name} {item.name === currentUserName && <span className="text-red-600 font-extrabold">(You)</span>}
                            </h4>
                            <p className="text-[9px] text-muted-foreground">{item.userRole} · {item.email}</p>
                            <p className="text-[10px] text-red-700 font-medium mt-1 leading-normal">
                              <strong>Status:</strong> {item.notes}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${
                          item.isSystem
                            ? "bg-red-500/10 border border-red-500/20 text-red-600"
                            : "bg-amber-500/10 border border-amber-500/20 text-amber-600"
                        }`}>
                          {item.isSystem ? "System" : "Manual"}
                        </span>
                      </div>
                    </div>
                  ))}

                  {holdsList.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                      <UserCheck size={28} className="text-emerald-500/50 mb-2" />
                      <p className="text-xs font-semibold text-foreground">Clearance Holds Clean</p>
                      <p className="text-[10px] mt-0.5">No students or faculty have active clearance holds.</p>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Footer / Quick Help */}
            <div className="px-5 py-3 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 text-[10px] text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Info size={11} /> Filtered dynamically
              </span>
              <span>DLSU AdRIC Equipment Management System</span>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
