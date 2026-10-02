import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import { useSession, roleToSlug } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { useBrowserOnly } from "@web/state/browserOnly";
import * as transfersApi from "@web/api/transfers.api";
import * as disposalsApi from "@web/api/disposals.api";
import type { Role } from "@shared/enums/role";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Wrench,
  ArrowLeftRight,
  ClipboardCheck,
  AlertTriangle,
  Trash2,
  CheckCircle,
  X,
  Clock,
  Activity,
  UserCheck,
  UserX,
  Info,
  ExternalLink,
  ShieldAlert,
  FileSpreadsheet
} from "lucide-react";

export function NotificationCenter() {
  const { role, currentUser } = useSession();
  const {
    assets,
    repairRequests,
    dbTransfers,
    dbLoans,
    pendingDisposals,
    acknowledgeRepair,
    authorizeLoan,
    syncFromDb
  } = useServerData();
  const { returns, manualClearanceHolds } = useBrowserOnly();

  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"requests" | "reminders" | "holds">("requests");
  const panelRef = useRef<HTMLDivElement>(null);

  const currentUserId = currentUser?.user_id || currentUser?.id;
  const currentUserName = currentUser
    ? `${currentUser.firstName || currentUser.first_name || ""} ${currentUser.lastName || currentUser.last_name || ""}`.trim()
    : "A. Dela Cruz";
  const currentUserEmail = currentUser?.email || "";

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

  // ────────────────────────────────────────────────────────────────────────────
  // Calculate Role-Aware Dynamic Notifications Engine
  // ────────────────────────────────────────────────────────────────────────────
  const {
    requestsList,
    remindersList,
    holdsList,
    requestsBadge,
    remindersBadge,
    holdsBadge,
    totalBadgeCount
  } = useMemo(() => {
    if (!role) {
      return {
        requestsList: [],
        remindersList: [],
        holdsList: [],
        requestsBadge: 0,
        remindersBadge: 0,
        holdsBadge: 0,
        totalBadgeCount: 0
      };
    }

    // 1. CLEARANCE HOLDS TAB
    const holds: { id: string; name: string; email: string; userRole: string; notes: string; isSystem: boolean; needsAction: boolean }[] = [];

    // Manual clearance holds
    manualClearanceHolds.forEach(h => {
      if (h.holdStatus === "Hold Active") {
        let isRelevant = false;
        let actionRequired = false;

        if (role === "AdRICDirector" || role === "ITS" || role === "TSG") {
          isRelevant = true;
          actionRequired = role === "AdRICDirector";
        } else if (role === "LabHead") {
          isRelevant = true;
        } else if (role === "Custodian" && (h.name === currentUserName || h.email === currentUserEmail)) {
          isRelevant = true;
          actionRequired = true;
        }

        if (isRelevant) {
          holds.push({
            id: `HOLD-M-${h.userId}`,
            name: h.name,
            email: h.email,
            userRole: h.role,
            notes: h.notes || "Manual clearance hold active.",
            isSystem: false,
            needsAction: actionRequired
          });
        }
      }
    });

    // System-flagged clearance holds (Overdue equipment delinquency)
    const overdueAssets = assets.filter(a => a.status === "Overdue" || (a.daysLeft !== undefined && a.daysLeft < 0));
    const uniqueCustodiansWithOverdue = Array.from(new Set(overdueAssets.map(a => a.custodian).filter(Boolean)));

    uniqueCustodiansWithOverdue.forEach((custName, idx) => {
      if (custName && !holds.some(h => h.name === custName)) {
        let isRelevant = false;
        let actionRequired = false;

        if (role === "AdRICDirector" || role === "ITS" || role === "TSG") {
          isRelevant = true;
          actionRequired = role === "AdRICDirector";
        } else if (role === "LabHead") {
          const hasLabOverdue = overdueAssets.some(a => a.custodian === custName && (a.lab === "CITe4D" || a.location === "Manila"));
          if (hasLabOverdue) isRelevant = true;
        } else if (role === "Custodian" && custName === currentUserName) {
          isRelevant = true;
          actionRequired = true;
        }

        if (isRelevant) {
          const isFaculty = custName === "Felix Torres" || custName.startsWith("Dr.");
          holds.push({
            id: `HOLD-S-${idx + 10}`,
            name: custName,
            email: `${custName.toLowerCase().replace(/\s/g, "")}@dlsu.edu.ph`,
            userRole: isFaculty ? "Faculty" : "Student",
            notes: "System-Flagged: Overdue equipment delinquency blocking clearance.",
            isSystem: true,
            needsAction: actionRequired
          });
        }
      }
    });

    // 2. REQUESTS TAB (Repairs, Custody Transfers, Equipment Loans, Returns, Disposals)
    const requests: {
      id: string;
      type: "repair" | "transfer" | "loan" | "return" | "disposal";
      title: string;
      description: string;
      date: string;
      priority?: string;
      needsAction: boolean;
      targetTab?: string;
      meta: any;
    }[] = [];

    // A. Repair Tickets (Strictly for ITS Admin / TSG or AdRIC Director, NOT shown to Lab Head)
    repairRequests.forEach(rep => {
      const isOverdueOrActive = rep.statusLabel !== "Fixed & Completed";
      if (isOverdueOrActive) {
        let isRelevant = false;
        let actionRequired = false;

        if (role === "ITS" || role === "TSG") {
          isRelevant = true;
          actionRequired = !rep.acknowledged;
        } else if (role === "AdRICDirector") {
          isRelevant = rep.priority === "Critical" || !rep.acknowledged;
        } else if (role === "Custodian") {
          if (rep.custodian === currentUserName || rep.custodian === currentUserId?.toString()) isRelevant = true;
        }

        if (isRelevant) {
          requests.push({
            id: rep.id,
            type: "repair",
            title: `Repair Ticket: ${rep.assetName}`,
            description: `Reported by ${rep.custodian}: "${rep.description}" (Priority: ${rep.priority})`,
            date: rep.submittedAt,
            priority: rep.priority,
            needsAction: actionRequired,
            targetTab: "repairs",
            meta: rep
          });
        }
      }
    });

    // B. Custody Transfers
    const rawTransfers = dbTransfers || [];
    rawTransfers.forEach((txn: any) => {
      const status = (txn.status || "").toLowerCase();
      if (status === "pending") {
        let isRelevant = false;
        let actionRequired = false;

        const fromName = txn.from || `Custodian ${txn.from_custodian_id}`;
        const toName = txn.to || `Custodian ${txn.to_custodian_id}`;
        const assetTitle = txn.assetName || txn.asset || txn.asset_tag || "Equipment";

        if (role === "AdRICDirector") {
          isRelevant = true;
        } else if (role === "ITS" || role === "TSG") {
          isRelevant = true;
          actionRequired = true;
        } else if (role === "LabHead") {
          if (txn.from_lab?.includes("CITe4D") || txn.to_lab?.includes("CITe4D") || txn.lab === "CITe4D") {
            isRelevant = true;
            actionRequired = true;
          }
        } else if (role === "Custodian") {
          const isToMe = (currentUserId && txn.to_custodian_id === currentUserId) || (toName.toLowerCase().includes(currentUserName.toLowerCase()));
          const isFromMe = (currentUserId && txn.from_custodian_id === currentUserId) || (fromName.toLowerCase().includes(currentUserName.toLowerCase()));
          if (isToMe || isFromMe) {
            isRelevant = true;
            actionRequired = isToMe;
          }
        }

        if (isRelevant) {
          requests.push({
            id: txn.id || `TR-${txn.transfer_id}`,
            type: "transfer",
            title: `Custody Transfer: ${assetTitle}`,
            description: `Transfer initiated from ${fromName} (${txn.from_lab || "Manila"}) to ${toName} (${txn.to_lab || "Manila"})`,
            date: txn.requested_on || txn.initiated || new Date().toISOString(),
            needsAction: actionRequired,
            targetTab: "transfers",
            meta: txn
          });
        }
      }
    });

    // C. Equipment Loan Requests (dbLoans) - Includes LOAN-9 for Lab Head
    const rawLoans = (dbLoans && dbLoans.length > 0) ? dbLoans : [];
    rawLoans.forEach((loan: any) => {
      const status = (loan.status || "").toLowerCase();
      if (status === "pending" || status === "pending approval") {
        let isRelevant = false;
        let actionRequired = false;

        if (role === "LabHead") {
          const matchesLab = !currentUser?.center_id || loan.center_id === currentUser.center_id || !loan.lab || loan.lab.includes("CITe4D") || loan.lab.includes("Manila");
          if (matchesLab) {
            isRelevant = true;
            actionRequired = true; // Pending Lab Head authorization
          }
        } else if (role === "ITS" || role === "TSG" || role === "AdRICDirector") {
          isRelevant = true;
          actionRequired = role === "ITS" || role === "TSG";
        } else if (role === "Custodian") {
          const isMyLoan = (currentUserId && loan.borrower_id === currentUserId) || (loan.borrower && loan.borrower.toLowerCase().includes(currentUserName.toLowerCase()));
          if (isMyLoan) isRelevant = true;
        }

        if (isRelevant) {
          const assetName = loan.assetName || loan.asset || loan.assetId || "ASUS TUF Gaming A15";
          requests.push({
            id: loan.id || `LOAN-${loan.loanId || loan.loan_id}`,
            type: "loan",
            title: `Equipment Loan Request: ${assetName}`,
            description: `Borrower: ${loan.borrower || "Faculty/Student"} • Purpose: "${loan.purpose || "Research Project Use"}"`,
            date: loan.requestedOn || loan.loaned_on || new Date().toISOString(),
            needsAction: actionRequired,
            targetTab: "custody",
            meta: loan
          });
        }
      }
    });

    // D. Return Requests
    returns.forEach(ret => {
      if (ret.status === "Pending") {
        let isRelevant = false;
        let actionRequired = false;

        if (role === "ITS" || role === "TSG") {
          isRelevant = true;
          actionRequired = true;
        } else if (role === "LabHead") {
          isRelevant = true;
          actionRequired = true;
        } else if (role === "AdRICDirector") {
          isRelevant = true;
        } else if (role === "Custodian" && ret.custodian === currentUserName) {
          isRelevant = true;
        }

        if (isRelevant) {
          requests.push({
            id: ret.id,
            type: "return",
            title: `Return Request: ${ret.assetName}`,
            description: `Returned by ${ret.custodian}. Awaiting final inspection clearance.`,
            date: ret.returnDate,
            needsAction: actionRequired,
            targetTab: "returns",
            meta: ret
          });
        }
      }
    });

    // E. Decommission Disposals (AdRIC Director Approvals)
    pendingDisposals.forEach(disp => {
      let isRelevant = false;
      let actionRequired = false;

      if (role === "AdRICDirector") {
        isRelevant = true;
        actionRequired = true; // Director sign-off needed
      } else if (role === "ITS" || role === "TSG") {
        isRelevant = true;
      } else if (role === "LabHead") {
        isRelevant = true;
      }

      if (isRelevant) {
        requests.push({
          id: disp.id,
          type: "disposal",
          title: `Disposal Authorization: ${disp.assetName}`,
          description: `Decommission request: "${disp.breakdownReasons}". Pathway: ${disp.disposalPathway}. Requested by: ${disp.requestedBy}.`,
          date: disp.requestedAt,
          needsAction: actionRequired,
          targetTab: "disposals",
          meta: disp
        });
      }
    });

    // Sort requests: Action required first, then newest
    requests.sort((a, b) => {
      if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // 3. REMINDERS TAB (Overdue Loans, Degraded Health)
    const reminders: {
      id: string;
      type: "overdue" | "duesoon" | "degraded";
      title: string;
      description: string;
      date?: string;
      needsAction: boolean;
      targetTab?: string;
      meta: any;
    }[] = [];

    // Overdue, Due Soon, or Degraded Health Equipment
    assets.forEach(asset => {
      const isOverdue = asset.status === "Overdue" || (asset.daysLeft !== undefined && asset.daysLeft < 0);
      const isDueSoon = asset.daysLeft !== undefined && asset.daysLeft >= 0 && asset.daysLeft <= 5;
      const isDegraded = asset.condition <= 60 && asset.status !== "Disposed";

      const isMyAsset = asset.custodian === currentUserName;
      const isHighValue = (asset.cost || 0) >= 50000;

      // Overdue Asset
      if (isOverdue) {
        let isRelevant = false;
        let actionRequired = false;

        if (role === "AdRICDirector") {
          if (isHighValue) isRelevant = true;
        } else if (role === "LabHead") {
          if (asset.lab === "CITe4D" || asset.location === "Manila") isRelevant = true;
        } else if (role === "Custodian") {
          if (isMyAsset) {
            isRelevant = true;
            actionRequired = true;
          }
        } else if (role === "ITS" || role === "TSG") {
          isRelevant = true;
        }

        if (isRelevant) {
          reminders.push({
            id: `REM-OVD-${asset.id}`,
            type: "overdue",
            title: `Overdue Equipment Return: ${asset.name}`,
            description: isMyAsset
              ? `WARNING: This device was due on ${asset.dueDate}. Return immediately to clear registration hold.`
              : `Custodian ${asset.custodian || "Unknown"} is overdue returning ${asset.name} (Due: ${asset.dueDate}).`,
            needsAction: actionRequired,
            targetTab: role === "Custodian" ? "myassets" : "inventory",
            meta: asset
          });
        }
      }

      // Due Soon
      if (isDueSoon) {
        let isRelevant = (role === "Custodian" && isMyAsset) || (role === "LabHead" && asset.lab === "CITe4D");
        if (isRelevant) {
          reminders.push({
            id: `REM-DUE-${asset.id}`,
            type: "duesoon",
            title: `Return Reminder: ${asset.name}`,
            description: isMyAsset
              ? `Your borrowed device is due in ${asset.daysLeft} days (on ${asset.dueDate}).`
              : `Device held by ${asset.custodian} is due in ${asset.daysLeft} days.`,
            needsAction: isMyAsset,
            targetTab: role === "Custodian" ? "myassets" : "inventory",
            meta: asset
          });
        }
      }

      // Degraded Condition / High Value Maintenance
      if (isDegraded) {
        let isRelevant = role === "ITS" || role === "TSG" || (role === "AdRICDirector" && isHighValue) || (role === "LabHead" && asset.lab === "CITe4D");
        if (isRelevant) {
          reminders.push({
            id: `REM-DEG-${asset.id}`,
            type: "degraded",
            title: `Degraded Health Alert: ${asset.name}`,
            description: `Device condition is at ${asset.condition}% in lab ${asset.lab}. Maintenance inspection recommended.`,
            needsAction: role === "TSG" || (role === "LabHead" && asset.lab === "CITe4D"),
            targetTab: "repairs",
            meta: asset
          });
        }
      }
    });

    // Active / Approved Equipment Loans (dbLoans) - Exclude Returned / Completed items
    const rawLoansForReminders = (dbLoans && dbLoans.length > 0) ? dbLoans : [];
    rawLoansForReminders.forEach((loan: any) => {
      const statusUpper = (loan.status || "").toUpperCase();
      const isReturned = statusUpper === "RETURNED" || statusUpper === "COMPLETED";
      if (isReturned) return;

      const isActive = statusUpper === "APPROVED" || statusUpper === "ACTIVE" || statusUpper === "ON_LOAN" || statusUpper === "ON LOAN";

      if (isActive) {
        let isRelevant = false;
        let actionRequired = false;

        const borrowerNameLower = (loan.borrower || "").trim().toLowerCase();
        const currentUserNameLower = currentUserName.trim().toLowerCase();
        const isBorrower = Boolean(
          (currentUserId && Number(loan.borrower_id) === Number(currentUserId)) ||
          (currentUser?.user_id && Number(loan.borrower_id) === Number(currentUser.user_id)) ||
          (currentUserEmail && loan.borrower_email === currentUserEmail) ||
          (borrowerNameLower && (borrowerNameLower === currentUserNameLower || (borrowerNameLower.length > 3 && currentUserNameLower.includes(borrowerNameLower))))
        );

        if (role === "Custodian") {
          if (isBorrower) {
            isRelevant = true;
            actionRequired = true;
          }
        } else if (role === "LabHead") {
          const matchesLab = !currentUser?.center_id || loan.center_id === currentUser.center_id || !loan.lab || loan.lab.includes("CITe4D") || loan.lab.includes("Manila");
          if (matchesLab) {
            isRelevant = true;
            actionRequired = true;
          }
        } else if (role === "ITS" || role === "TSG" || role === "AdRICDirector") {
          isRelevant = true;
          actionRequired = true;
        }

        if (isRelevant) {
          const assetName = loan.assetName || loan.asset || loan.assetId || "ASUS TUF Gaming A15";
          const dueDate = loan.dueDate || loan.due_date || loan.returnDate || "2026-08-25";
          const labName = loan.lab || "Center for ICT for Development (CITE4D)";

          reminders.push({
            id: `REM-LOAN-${loan.id || loan.loanId || loan.loan_id}`,
            type: "active_loan",
            title: `Active Equipment Loan: ${assetName}`,
            description: `Due Date: ${dueDate} • Lab: ${labName}`,
            date: dueDate,
            needsAction: actionRequired,
            targetTab: role === "Custodian" ? "myassets" : "inventory",
            meta: loan
          });
        }
      }
    });

    // Sort reminders: Overdue first, then needsAction
    reminders.sort((a, b) => {
      if (a.type === "overdue" && b.type !== "overdue") return -1;
      if (b.type === "overdue" && a.type !== "overdue") return 1;
      return a.needsAction ? -1 : 1;
    });

    // Calculate Badges
    const rBadge = requests.filter(r => r.needsAction).length;
    const remBadge = reminders.filter(r => r.needsAction).length;
    const hBadge = holds.filter(h => h.needsAction).length;
    const totBadge = rBadge + remBadge + hBadge;

    return {
      requestsList: requests,
      remindersList: reminders,
      holdsList: holds,
      requestsBadge: rBadge,
      remindersBadge: remBadge,
      holdsBadge: hBadge,
      totalBadgeCount: totBadge
    };
  }, [role, currentUser, currentUserName, currentUserEmail, currentUserId, assets, repairRequests, dbTransfers, dbLoans, returns, pendingDisposals, manualClearanceHolds]);

  if (!role) return null;

  const hasPersonalHold = holdsList.some(h => h.name === currentUserName);
  const personalHoldNotes = holdsList.find(h => h.name === currentUserName)?.notes;

  const decideTransferFromBell = async (txn: any, decision: "approve" | "decline") => {
    const transferId = txn?.transferId ?? txn?.transfer_id;
    if (transferId === undefined) {
      console.error("Transfer decision skipped: this row has no database id.", txn);
      return;
    }
    try {
      const data = await transfersApi.decideTransfer(transferId, decision);
      if (!data.success) console.error("Failed to decide transfer:", data.error);
    } catch (err) {
      console.error("Failed to decide transfer:", err);
    }
    await syncFromDb();
  };

  const decideDisposalFromBell = async (disp: any, decision: "approve" | "reject") => {
    if (disp?.disposalId === undefined) {
      console.error("Disposal decision skipped: this row has no database id.", disp);
      return;
    }
    try {
      const data = await disposalsApi.decideDisposal(disp.disposalId, decision);
      if (!data.success) console.error("Failed to decide disposal:", data.error);
    } catch (err) {
      console.error("Failed to decide disposal:", err);
    }
    await syncFromDb();
  };

  const handleCardClick = (targetTab?: string) => {
    if (targetTab && role) {
      const slug = roleToSlug[role];
      let actualTab = targetTab;
      if (role === "Custodian" && (targetTab === "inventory" || targetTab === "custody")) {
        actualTab = "myassets";
      }
      navigate(`/${slug}/${actualTab}`);
      setIsOpen(false);
    }
  };

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
        aria-label="Toggle notification center"
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
            className="absolute bottom-16 right-0 w-[calc(100vw-3rem)] sm:w-[430px] max-h-[580px] rounded-2xl border flex flex-col shadow-2xl overflow-hidden backdrop-blur-md"
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
                  Scope: <span className="font-semibold text-primary">{currentUserName}</span> ({role})
                </p>
              </div>
              <span className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-2.5 py-1 rounded-md font-extrabold tracking-wide">
                {totalBadgeCount} Action Required
              </span>
            </div>

            {/* Warning Banner if active clearance hold exists */}
            {role === "Custodian" && hasPersonalHold && (
              <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-start gap-2.5">
                <AlertTriangle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] font-extrabold text-red-800">Clearance Hold Active</p>
                  <p className="text-[10px] text-red-700 leading-normal">{personalHoldNotes || "System hold due to overdue equipment."}</p>
                </div>
              </div>
            )}

            {/* Tabs Header Badges */}
            <div className="flex border-b border-border text-xs font-semibold bg-slate-50/30 dark:bg-slate-900/5">
              {[
                { id: "requests", label: "Requests", badge: requestsBadge },
                { id: "reminders", label: "Reminders", badge: remindersBadge },
                { id: "holds", label: "Clearance Holds", badge: holdsBadge }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-center border-b-2 transition-all relative cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === tab.id
                    ? "border-primary text-primary font-bold bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-slate-50/20"
                    }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[9px] font-extrabold shadow-xs">
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
                      onClick={() => handleCardClick(item.targetTab)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 cursor-pointer hover:border-primary/50 group ${item.needsAction
                        ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-300/60 shadow-xs"
                        : "bg-card border-border/80 hover:bg-muted/10"
                        }`}
                    >
                      <div className="flex items-start gap-2.5 justify-between">
                        <div className="flex items-start gap-2.5">
                          <span className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${item.type === "repair" ? "bg-red-50 text-red-600 border border-red-100" :
                            item.type === "transfer" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                              item.type === "loan" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                item.type === "return" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                  "bg-purple-50 text-purple-600 border border-purple-100"
                            }`}>
                            {item.type === "repair" && <Wrench size={14} />}
                            {item.type === "transfer" && <ArrowLeftRight size={14} />}
                            {item.type === "loan" && <ClipboardCheck size={14} />}
                            {item.type === "return" && <ClipboardCheck size={14} />}
                            {item.type === "disposal" && <Trash2 size={14} />}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold leading-tight group-hover:text-primary transition-colors">{item.title}</h4>
                              <ExternalLink size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">{item.description}</p>
                          </div>
                        </div>
                        {item.needsAction && (
                          <span className="flex-shrink-0 text-[8px] bg-red-600 text-white font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider animate-pulse">
                            Pending Approval
                          </span>
                        )}
                      </div>

                      {/* Dynamic Inline Action Controls */}
                      {item.needsAction && (
                        <div
                          className="flex items-center justify-end gap-1.5 border-t border-dashed border-border/60 pt-2 mt-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Acknowledge Repair Ticket Button */}
                          {item.type === "repair" && (role === "ITS" || role === "TSG") && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await acknowledgeRepair(item.id);
                              }}
                              className="text-[10px] font-bold text-white bg-primary hover:bg-primary/90 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle size={10} /> Acknowledge Repair
                            </button>
                          )}

                          {/* Authorize Equipment Loan Button */}
                          {item.type === "loan" && (role === "LabHead" || role === "ITS" || role === "TSG") && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  await authorizeLoan(item.id, "approve");
                                  await syncFromDb();
                                } catch (err: any) {
                                  console.error("Failed to authorize loan:", err);
                                }
                              }}
                              className="text-[10px] font-bold text-white bg-[#005A36] hover:bg-[#004225] px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle size={10} /> Authorize Loan
                            </button>
                          )}

                          {/* Authorize Custody Transfer Buttons */}
                          {item.type === "transfer" && role === "LabHead" && (
                            <div className="flex gap-1">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await decideTransferFromBell(item.meta, "approve");
                                }}
                                className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                Approve Transfer
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await decideTransferFromBell(item.meta, "decline");
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
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await decideDisposalFromBell(item.meta, "approve");
                                }}
                                className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                Authorize Disposal
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await decideDisposalFromBell(item.meta, "reject");
                                }}
                                className="text-[10px] font-bold text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}

                          {item.type === "return" && (
                            <span className="text-[9px] text-primary font-bold flex items-center gap-1 cursor-pointer hover:underline">
                              Inspect Return Item <ExternalLink size={9} />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {requestsList.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                      <CheckCircle size={32} className="text-emerald-500/50 mb-2" />
                      <p className="text-xs font-bold text-foreground">No Pending Requests</p>
                      <p className="text-[10px] mt-0.5">All repair, transfer, loan, and disposal requests for your role are up to date.</p>
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
                      onClick={() => handleCardClick(item.targetTab)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer hover:border-primary/50 group ${item.needsAction
                        ? "bg-red-50/20 dark:bg-red-950/10 border-red-300/40"
                        : "bg-card border-border/80 hover:bg-muted/10"
                        }`}
                    >
                      <div className="flex items-start gap-2.5 justify-between">
                        <div className="flex items-start gap-2.5">
                          <span className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${item.type === "overdue" ? "bg-red-50 text-red-600 border border-red-100" :
                            item.type === "duesoon" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                              item.type === "active_loan" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                "bg-orange-50 text-orange-600 border border-orange-100"
                            }`}>
                            {item.type === "overdue" && <AlertTriangle size={14} />}
                            {item.type === "duesoon" && <Clock size={14} />}
                            {item.type === "active_loan" && <ClipboardCheck size={14} />}
                            {item.type === "degraded" && <Activity size={14} />}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold leading-tight group-hover:text-primary transition-colors">{item.title}</h4>
                              <ExternalLink size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">{item.description}</p>
                          </div>
                        </div>
                        {item.type === "active_loan" && (
                          <span className="flex-shrink-0 text-[8px] bg-emerald-600 text-white font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">
                            Active / On Loan
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {remindersList.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                      <CheckCircle size={32} className="text-emerald-500/50 mb-2" />
                      <p className="text-xs font-bold text-foreground">No Active Reminders</p>
                      <p className="text-[10px] mt-0.5">No overdue equipment or maintenance alerts detected for your role.</p>
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
                      className={`p-3.5 rounded-xl border bg-card border-border/80 transition-all flex flex-col gap-2 ${item.name === currentUserName ? "border-red-400 bg-red-50/10 shadow-2xs" : ""
                        }`}
                    >
                      <div className="flex items-start gap-2.5 justify-between">
                        <div className="flex items-start gap-2.5">
                          <span className="p-1.5 rounded-lg bg-red-50 text-red-600 flex-shrink-0 mt-0.5 border border-red-100">
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
                        <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${item.isSystem
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
                      <UserCheck size={32} className="text-emerald-500/50 mb-2" />
                      <p className="text-xs font-bold text-foreground">Clearance Holds Clean</p>
                      <p className="text-[10px] mt-0.5">No active clearance holds recorded for your scope.</p>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Footer / Quick Help */}
            <div className="px-5 py-3 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 text-[10px] text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1 font-medium">
                <Info size={11} className="text-[#005A36]" /> Dynamic role-filtered notification stream
              </span>
              <span className="font-semibold text-slate-500">DLSU AdRIC EMS</span>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
