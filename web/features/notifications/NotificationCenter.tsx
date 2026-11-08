/**
 * Notification bell: a floating panel listing requests and reminders for the signed-in role.
 * Layer: feature component. Called by app/layouts/RootLayout.tsx, on every signed-in screen.
 * Calls: api/notifications.api.ts getMyNotifications(), features/disposals/DisposalDecisionControls.tsx and
 * CompleteDisposalDialog.tsx (api/retirements.api.ts), and state/serverData.tsx (the shared lists, authorizeLoan).
 * Used by: every role.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSession, roleToSlug, roleDefaultPath, roleLabel } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import * as notificationsApi from "@web/api/notifications.api";
import { Button } from "@web/components/ui/button";
import { Textarea } from "@web/components/ui/textarea";
import { DisposalDecisionControls } from "@web/features/disposals/DisposalDecisionControls";
import { CompleteDisposalDialog } from "@web/features/disposals/CompleteDisposalDialog";
import type { Retirement } from "@shared/types/retirements";
import { labMatches } from "@web/features/labs/labMatches";
import type { Role } from "@shared/enums/role";
import type { Notification } from "@shared/types/notifications";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  Trash2,
  CheckCircle,
  X,
  Clock,
  Activity,
  ExternalLink,
} from "lucide-react";

/** One card on the Requests tab. */
interface RequestCard {
  id: string;
  type: "repair" | "loan" | "release" | "return" | "disposal";
  title: string;
  description: string;
  date: string;
  needsAction: boolean;
  /** The red tag on a card that needs action. */
  badge?: string;
  targetTab?: string;
  meta: any;
}

/** One card on the Reminders tab. */
interface ReminderCard {
  id: string;
  type: "overdue" | "duesoon" | "degraded" | "statuscheck";
  title: string;
  description: string;
  needsAction: boolean;
  targetTab?: string;
  meta: any;
}

/**
 * Shows the role's notifications and offers the decisions that role may make from the bell: the Director and the
 * Secretary approve or deny disposals they did not request, TSG completes an approved disposal, Lab Heads approve or decline loans. A repair ticket waiting for receipt is a card for Staff and
 * the Director that leads to the Repairs page, where TSG receives the asset.
 * The server (GET /api/notifications/mine, matched there by user id) decides who has something to do. It sends the
 * loan, return, due-soon, overdue and status check cards, and RECEIPT_WAITING and DISPOSAL_DECISION_WAITING, which mark
 * the ticket and disposal cards that need the person's action. The details of those cards come from the shared lists
 * (tickets, retirements), and so do the health cards. MAINTENANCE_OPEN shows a Researcher or Lab Head their open tickets.
 * Each decision calls the API and then reloads the shared lists. Clicking a card opens the matching tab. Takes no props.
 */
export function NotificationCenter() {
  const { role, currentUser } = useSession();
  const {
    assets,
    assetsVersion,
    tickets,
    dbLoans,
    retirements,
    authorizeLoan,
    syncFromDb
  } = useServerData();

  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"requests" | "reminders">("requests");
  const panelRef = useRef<HTMLDivElement>(null);
  // The approved disposal TSG is completing from a card.
  const [completing, setCompleting] = useState<Retirement | null>(null);

  // The name is shown in the panel header only. No card is matched by it.
  const currentUserName = currentUser
    ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
    : "";

  // The loan notifications, from the server. They load when the bell mounts, each time the shared lists reload (every
  // save reloads them), and when the panel opens. A failed load keeps what the panel showed before.
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const loadNotifications = useCallback(async () => {
    if (!role || role === "ITAdmin") {
      setNotifications([]);
      return;
    }
    try {
      const data = await notificationsApi.getMyNotifications();
      if (data.success && Array.isArray(data.notifications)) setNotifications(data.notifications);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
  }, [role]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, assetsVersion]);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen, loadNotifications]);

  // The Lab Head's open Decline box: which loan, the reason written, and the server's refusal if there was one.
  const [decliningLoanId, setDecliningLoanId] = useState<number | null>(null);
  const [declineRemarks, setDeclineRemarks] = useState("");
  const [decisionError, setDecisionError] = useState<{ loanId: number; message: string } | null>(null);

  const decideLoanFromBell = async (loanId: number, decision: "approve" | "decline") => {
    setDecisionError(null);
    const error = await authorizeLoan(`LOAN-${loanId}`, decision, declineRemarks);
    if (error) {
      setDecisionError({ loanId, message: error });
      return;
    }
    setDecliningLoanId(null);
    setDeclineRemarks("");
    await syncFromDb();
    await loadNotifications();
  };

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
    requestsBadge,
    remindersBadge,
    totalBadgeCount
  } = useMemo(() => {
    if (!role) {
      return {
        requestsList: [] as RequestCard[],
        remindersList: [] as ReminderCard[],
        requestsBadge: 0,
        remindersBadge: 0,
        totalBadgeCount: 0
      };
    }

    const assetNameOf = (tag?: string) => assets.find(a => a.id === tag)?.name ?? tag ?? "Unknown asset";
    // The tickets and disposals the server says this person has to act on.
    const receiptWaitingIds = new Set(notifications.filter(n => n.kind === "RECEIPT_WAITING").map(n => n.maintenanceId));
    const decisionWaitingIds = new Set(notifications.filter(n => n.kind === "DISPOSAL_DECISION_WAITING").map(n => n.retirementId));

    // REQUESTS TAB (Repairs, Equipment Loans, Returns, Disposals)
    const requests: RequestCard[] = [];

    // A. Repair tickets waiting for TSG to receive the asset (Staff and AdRIC Director only, NOT shown to Lab Head).
    // Only TSG can receive, so only the card the server marks with RECEIPT_WAITING needs action.
    if (role === "Staff" || role === "AdRICDirector") {
      tickets.filter(t => t.status === "PENDING_RECEIPT").forEach(t => {
        const reporter = "hidden" in t.reportedBy ? "a researcher" : t.reportedBy.name;
        requests.push({
          id: `MNT-${t.maintenanceId}`,
          type: "repair",
          title: `Repair Ticket: ${t.asset.name}`,
          description: `Reported by ${reporter}: "${t.issueDescription}" (${t.issueType?.name ?? t.typeLabel})`,
          date: t.reportedAt,
          needsAction: receiptWaitingIds.has(t.maintenanceId),
          badge: "Waiting for Receipt",
          targetTab: "repairs",
          meta: t
        });
      });
    }

    // B. Loan cards, one per server notification. Only the Head, TSG and the borrower get any, so there is no role check.
    notifications.forEach(n => {
      if (n.kind === "LOAN_AWAITING_APPROVAL") {
        const loan = dbLoans.find((l) => l.loanId === n.loanId);
        requests.push({
          id: `LOAN-${n.loanId}`,
          type: "loan",
          title: `Asset Loan Request: ${assetNameOf(n.assetTag)}`,
          description: loan
            ? `Borrower: ${loan.borrower || "A researcher"} • Purpose: "${loan.purpose || "Research Project Use"}"`
            : n.label,
          date: n.date ?? "",
          needsAction: true,
          badge: "Pending Approval",
          targetTab: "custody",
          meta: n
        });
      } else if (n.kind === "RELEASE_WAITING") {
        requests.push({
          id: `REL-${n.loanId}`,
          type: "release",
          title: `Loan Ready for Release: ${assetNameOf(n.assetTag)}`,
          description: `${n.label}. The Lab Head approved it${n.date ? ` on ${n.date}` : ""}.`,
          date: n.date ?? "",
          needsAction: true,
          badge: "Waiting for Release",
          meta: n
        });
      } else if (n.kind === "RETURN_WAITING") {
        requests.push({
          id: `RET-${n.loanId}`,
          type: "return",
          title: `Return Request: ${assetNameOf(n.assetTag)}`,
          description: `${n.label}. Awaiting final inspection clearance.`,
          date: n.date ?? "",
          needsAction: true,
          badge: "Return Waiting",
          targetTab: "returns",
          meta: n
        });
      } else if (n.kind === "MAINTENANCE_OPEN") {
        // The reporter's own open ticket (a Researcher or a Lab Head; TSG gets RECEIPT_WAITING instead). Nothing to do but read it.
        const ticket = tickets.find(t => t.maintenanceId === n.maintenanceId);
        requests.push({
          id: `MNT-OPEN-${n.maintenanceId}`,
          type: "repair",
          title: `${n.label}: ${assetNameOf(n.assetTag)}`,
          description: `MNT-${n.maintenanceId} is ${n.statusLabel}.${ticket ? ` ${ticket.issueType?.name ?? ticket.typeLabel}: "${ticket.issueDescription}"` : ""}`,
          date: n.date ?? "",
          needsAction: false,
          targetTab: "inventory",
          meta: n
        });
      }
    });

    // C. Disposals. The Director and the Secretary (the Staff view of the ITS account) decide the Pending ones they did
    // not request: the server marks those with DISPOSAL_DECISION_WAITING. TSG completes the Approved ones; a Lab Head
    // sees its lab's Pending ones (the server scopes the list). The cards come from GET /api/retirements.
    const isTsgStaff = role === "Staff" && currentUser?.staffUnit === "TSG";
    retirements.forEach(r => {
      const requester = "hidden" in r.requestedBy ? "TSG" : r.requestedBy.name;
      const base = {
        id: `RET-${r.retirementId}`,
        type: "disposal" as const,
        title: `Retirement Request: ${r.asset.name}`,
        date: r.requestedAt,
        targetTab: "disposals",
        meta: r,
      };
      if (r.status === "PENDING") {
        requests.push({
          ...base,
          description: `Reason: "${r.reason.replace(/\s+/g, " ").trim()}". Pathway: ${r.pathwayLabel ?? "Not named yet"}. Requested by: ${requester}.`,
          needsAction: decisionWaitingIds.has(r.retirementId),
          badge: "Pending Approval",
        });
      } else if (r.status === "APPROVED" && isTsgStaff) {
        requests.push({
          ...base,
          description: `Approved${r.decisionRemarks ? `: "${r.decisionRemarks}"` : ""}. Complete it with the pathway and the disposition reference.`,
          date: r.decidedAt ?? r.requestedAt,
          needsAction: true,
          badge: "Complete Retirement",
        });
      }
    });

    // Sort requests: Action required first, then newest
    const time = (d: string) => new Date(d).getTime() || 0;
    requests.sort((a, b) => {
      if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
      return time(b.date) - time(a.date);
    });

    // REMINDERS TAB (the borrower's overdue and due-soon loans, Degraded Health)
    const reminders: ReminderCard[] = [];

    notifications.forEach(n => {
      if (n.kind === "LOAN_OVERDUE") {
        reminders.push({
          id: `REM-OVD-${n.loanId}`,
          type: "overdue",
          title: `Overdue Asset Return: ${assetNameOf(n.assetTag)}`,
          description: `WARNING: This device was due on ${n.date}. Return it as soon as you can.`,
          needsAction: true,
          targetTab: "myassets",
          meta: n
        });
      } else if (n.kind === "LOAN_DUE_SOON") {
        reminders.push({
          id: `REM-DUE-${n.loanId}`,
          type: "duesoon",
          title: `Return Reminder: ${assetNameOf(n.assetTag)}`,
          description: `Your borrowed device is due on ${n.date}.`,
          needsAction: true,
          targetTab: "myassets",
          meta: n
        });
      } else if (n.kind === "STATUS_CHECK_DUE") {
        reminders.push({
          id: `REM-CHK-${n.loanId}`,
          type: "statuscheck",
          title: `${n.label}: ${assetNameOf(n.assetTag)}`,
          description: n.date
            ? `Its last inspection was on ${n.date}. Send a status report on the Report tab.`
            : "It has not been inspected yet. Send a status report on the Report tab.",
          needsAction: true,
          targetTab: "report",
          meta: n
        });
      }
    });

    // Degraded Health Equipment
    assets.forEach(asset => {
      const isDegraded = asset.healthScore != null && asset.healthScore <= 60 && asset.status !== "RETIRED";
      const isHighValue = (asset.cost || 0) >= 50000;

      if (isDegraded) {
        let isRelevant = role === "Staff" || (role === "AdRICDirector" && isHighValue) || (role === "LabHead" && labMatches(currentUser?.headOf?.code, asset.lab));
        if (isRelevant) {
          reminders.push({
            id: `REM-DEG-${asset.id}`,
            type: "degraded",
            title: `Degraded Health Alert: ${asset.name}`,
            description: `Device health score is ${asset.healthScore} in lab ${asset.lab}. Maintenance inspection recommended.`,
            needsAction: role === "Staff" || (role === "LabHead" && labMatches(currentUser?.headOf?.code, asset.lab)),
            targetTab: "repairs",
            meta: asset
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

    return {
      requestsList: requests,
      remindersList: reminders,
      requestsBadge: rBadge,
      remindersBadge: remBadge,
      totalBadgeCount: rBadge + remBadge
    };
  }, [role, currentUser, assets, tickets, dbLoans, notifications, retirements]);

  if (!role) return null;

  /**
   * Resolves the target URL for a notification card based on the role and card type.
   * Directs to the role's matching tab or falls back to roleDefaultPath.
   */
  const getCardPath = (cardRole: Role, cardType?: string, targetTab?: string): string => {
    const fallback = roleDefaultPath[cardRole];

    if (cardRole === "AdRICDirector") {
      if (cardType === "disposal" || targetTab === "disposals" || targetTab === "retirement-approvals") {
        return "/adric-director/retirement-approvals";
      }
      return fallback;
    }

    if (cardRole === "LabHead") {
      if (cardType === "loan" || targetTab === "custody") {
        return "/lab-head/custody";
      }
      if (targetTab === "inventory") {
        return "/lab-head/inventory";
      }
      return fallback;
    }

    if (cardRole === "Custodian") {
      // A status check is answered on the Report tab; loans, tickets and the due-soon and overdue reminders live in myassets.
      return targetTab === "report" ? "/custodian/report" : "/custodian/myassets";
    }

    if (cardRole === "Staff") {
      if (cardType === "repair" || cardType === "degraded" || targetTab === "repairs") {
        return "/staff/repairs";
      }
      if (cardType === "return" || targetTab === "returns") {
        return "/staff/returns";
      }
      if (targetTab === "inventory") {
        return "/staff/inventory";
      }
      return fallback;
    }

    return fallback;
  };

  const handleCardClick = (cardType?: string, targetTab?: string) => {
    if (role) {
      const destination = getCardPath(role, cardType, targetTab);
      navigate(destination);
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
                  Scope: <span className="font-semibold text-primary">{currentUserName}</span> ({roleLabel[role]})
                </p>
              </div>
              <span className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-2.5 py-1 rounded-md font-extrabold tracking-wide">
                {totalBadgeCount} Action Required
              </span>
            </div>

            {/* Tabs Header Badges */}
            <div className="flex border-b border-border text-xs font-semibold bg-slate-50/30 dark:bg-slate-900/5">
              {[
                { id: "requests", label: "Requests", badge: requestsBadge },
                { id: "reminders", label: "Reminders", badge: remindersBadge }
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
                      onClick={() => handleCardClick(item.type, item.targetTab)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 cursor-pointer hover:border-primary/50 group ${item.needsAction
                        ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-300/60 shadow-xs"
                        : "bg-card border-border/80 hover:bg-muted/10"
                        }`}
                    >
                      <div className="flex items-start gap-2.5 justify-between">
                        <div className="flex items-start gap-2.5">
                          <span className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${item.type === "repair" ? "bg-red-50 text-red-600 border border-red-100" :
                              item.type === "loan" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                item.type === "return" || item.type === "release" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                  "bg-purple-50 text-purple-600 border border-purple-100"
                            }`}>
                            {item.type === "repair" && <Wrench size={14} />}
                            {item.type === "loan" && <ClipboardCheck size={14} />}
                            {(item.type === "return" || item.type === "release") && <ClipboardCheck size={14} />}
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
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {/* Dynamic Inline Action Controls */}
                      {item.needsAction && (
                        <div
                          className="flex items-center justify-end gap-1.5 border-t border-dashed border-border/60 pt-2 mt-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* TSG receives the asset on the Repairs page, where the inspection is filled in. */}
                          {item.type === "repair" && (
                            <span className="text-[9px] text-primary font-bold flex items-center gap-1 cursor-pointer hover:underline">
                              Receive on the Repairs page <ExternalLink size={9} />
                            </span>
                          )}

                          {/* Equipment Loan Decision Buttons */}
                          {/* Lab Head only: the server refuses a loan decision from any other role (13b role table). */}
                          {item.type === "loan" && role === "LabHead" && (
                            <div className="flex flex-col items-end gap-2 w-full">
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 text-[10px] font-bold px-2.5 gap-1"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    await decideLoanFromBell(item.meta.loanId, "approve");
                                  }}
                                >
                                  <CheckCircle size={10} /> Approve
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px] font-bold px-2.5 border-destructive/30 text-destructive hover:text-destructive"
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDecliningLoanId(item.meta.loanId);
                                    setDeclineRemarks("");
                                    setDecisionError(null);
                                  }}
                                >
                                  Decline
                                </Button>
                              </div>
                              {decliningLoanId === item.meta.loanId && (
                                <div className="w-full flex flex-col gap-1.5">
                                  <Textarea
                                    value={declineRemarks}
                                    onChange={e => setDeclineRemarks(e.target.value)}
                                    rows={2}
                                    maxLength={2000}
                                    placeholder="Reason for declining"
                                    aria-label="Reason for declining"
                                    className="min-h-0 px-2 py-1.5 text-[11px]"
                                  />
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[10px] font-bold px-2.5"
                                      onClick={() => setDecliningLoanId(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 text-[10px] font-bold px-2.5"
                                      disabled={!declineRemarks.trim()}
                                      onClick={async () => { await decideLoanFromBell(item.meta.loanId, "decline"); }}
                                    >
                                      Confirm Decline
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {decisionError?.loanId === item.meta.loanId && (
                                <p className="text-[10px] text-destructive text-right">{decisionError.message}</p>
                              )}
                            </div>
                          )}

                          {/* Retirement decision (Director, Secretary) or completion (TSG) */}
                          {item.type === "disposal" && item.meta.status === "PENDING" && (
                            <DisposalDecisionControls retirement={item.meta} onDecided={syncFromDb} />
                          )}
                          {item.type === "disposal" && item.meta.status === "APPROVED" && (
                            <button
                              onClick={e => { e.stopPropagation(); setCompleting(item.meta); }}
                              className="text-[10px] font-bold text-white bg-red-700 hover:bg-red-800 px-3 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              Complete Retirement
                            </button>
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
                      <p className="text-[10px] mt-0.5">All repair, loan, and retirement requests for your role are up to date.</p>
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
                      onClick={() => handleCardClick(item.type, item.targetTab)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer hover:border-primary/50 group ${item.needsAction
                        ? "bg-red-50/20 dark:bg-red-950/10 border-red-300/40"
                        : "bg-card border-border/80 hover:bg-muted/10"
                        }`}
                    >
                      <div className="flex items-start gap-2.5 justify-between">
                        <div className="flex items-start gap-2.5">
                          <span className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${item.type === "overdue" ? "bg-red-50 text-red-600 border border-red-100" :
                            item.type === "duesoon" || item.type === "statuscheck" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                              "bg-orange-50 text-orange-600 border border-orange-100"
                            }`}>
                            {item.type === "overdue" && <AlertTriangle size={14} />}
                            {item.type === "duesoon" && <Clock size={14} />}
                            {item.type === "degraded" && <Activity size={14} />}
                            {item.type === "statuscheck" && <ClipboardCheck size={14} />}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold leading-tight group-hover:text-primary transition-colors">{item.title}</h4>
                              <ExternalLink size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {remindersList.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                      <CheckCircle size={32} className="text-emerald-500/50 mb-2" />
                      <p className="text-xs font-bold text-foreground">No Active Reminders</p>
                      <p className="text-[10px] mt-0.5">No due-soon or overdue loans, status checks or health alerts for your role.</p>
                    </div>
                  )}
                </>
              )}

            </div>

            {/* Footer / Quick Help */}
            <div className="px-5 py-3 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 text-[10px] text-muted-foreground flex items-center justify-end">
              <span className="font-semibold text-slate-500">DLSU AdRIC EMS</span>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
      {completing && <CompleteDisposalDialog retirement={completing} onClose={() => setCompleting(null)} onDone={syncFromDb} />}
    </div>
  );
}
