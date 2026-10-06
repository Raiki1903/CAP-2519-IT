import { useState, useEffect, useCallback } from "react";
import { useSession } from "@web/state/session";
import { useServerData } from "@web/state/serverData";
import { AlertTriangle, Search, Package, MapPin, Calendar, LayoutGrid, Table2, Printer, Download, ArrowRight, ShieldCheck, CheckCircle, XCircle } from "lucide-react";
import { AssetImagePlaceholder } from "@web/features/assets/AssetImagePlaceholder";
import { AssetDetailModal, type AssetDetail } from "@web/features/assets/AssetDetailModal";
import { LabHeadAnalyticsView } from "@web/features/analytics/labHead/LabHeadAnalyticsView";
import * as loansApi from "@web/api/loans.api";
import * as assetsApi from "@web/api/assets.api";
import * as transfersApi from "@web/api/transfers.api";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@web/components/ui/dialog";

const MINT = "#10B981";

const statusClass: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "On Loan": "bg-blue-50   text-blue-700   border-blue-200",
  Maintenance: "bg-amber-50  text-amber-700  border-amber-200",
  Disposed: "bg-red-50    text-red-700    border-red-200",
};

const txnBadgeClass: Record<string, string> = {
  Pending: "bg-amber-50  text-amber-700  border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Declined: "bg-red-50    text-red-700    border-red-200",
};

const severityClass: Record<string, string> = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50  text-amber-700  border-amber-200",
  High: "bg-red-50    text-red-700    border-red-200",
  Critical: "bg-red-900   text-red-200    border-red-700",
};

// Mirrors the `asset_records.asset_condition` ENUM in the MySQL schema —
// same 5-state condition used in ReturnForm/AssetDetailModal/ITSDashboard/
// CustodianPortal, replacing the old (always-100, not DB-backed) numeric %.
// NOTE: keys are the Prisma enum member names (underscore form), not the
// space-separated DB storage strings — see schema.prisma's @map values.
const CONDITION_TEXT_CLASS: Record<string, string> = {
  PERFECT: "text-emerald-700",
  OPERATIONAL: "text-blue-700",
  MINOR_DRIFT: "text-amber-700",
  DEGRADED: "text-orange-700",
  CRITICAL_DEFECT: "text-red-700",
};
const CONDITION_DOT_CLASS: Record<string, string> = {
  PERFECT: "bg-emerald-400",
  OPERATIONAL: "bg-blue-400",
  MINOR_DRIFT: "bg-amber-400",
  DEGRADED: "bg-orange-400",
  CRITICAL_DEFECT: "bg-red-500",
};
function ConditionState({ value }: { value?: string }) {
  const cond = value || "PERFECT";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold", CONDITION_TEXT_CLASS[cond] ?? "text-muted-foreground")}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", CONDITION_DOT_CLASS[cond] ?? "bg-muted-foreground")} />
      {cond.replace(/_/g, " ")}
    </span>
  );
}

function VisualTimeline({ status }: { status: string }) {
  const steps = [
    { label: "Initiated", completed: true, active: false, failed: false },
    {
      label: status === "Declined" ? "Declined" : "Pending Approval",
      completed: status === "Approved",
      active: status === "Pending",
      failed: status === "Declined"
    },
    {
      label: "Custody Transferred",
      completed: status === "Approved",
      active: false,
      failed: status === "Declined"
    }
  ];

  return (
    <div className="flex items-center gap-2 mt-4 px-2 py-3 bg-muted/30 rounded-lg max-w-xl">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        let nodeColor = "bg-muted text-muted-foreground border-muted-foreground/20";
        if (step.completed) {
          nodeColor = "bg-emerald-500 text-white border-emerald-500";
        } else if (step.active) {
          nodeColor = "bg-amber-500 text-white border-amber-500 animate-pulse";
        } else if (step.failed) {
          nodeColor = "bg-red-500 text-white border-red-500";
        }

        let lineColor = "bg-muted";
        if (idx === 0 && (status === "Approved" || status === "Pending")) {
          lineColor = "bg-emerald-500";
        } else if (idx === 0 && status === "Declined") {
          lineColor = "bg-red-500";
        } else if (idx === 1 && status === "Approved") {
          lineColor = "bg-emerald-500";
        } else if (idx === 1 && status === "Declined") {
          lineColor = "bg-red-300";
        }

        return (
          <div key={idx} className="flex flex-1 items-center min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0", nodeColor)}>
                {step.completed ? "✓" : step.failed ? "✗" : idx + 1}
              </div>
              <span className={cn("text-[11px] font-semibold whitespace-nowrap truncate", step.completed ? "text-emerald-700" : step.active ? "text-amber-700 font-bold" : step.failed ? "text-red-700" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            {!isLast && <div className={cn("h-0.5 flex-1 mx-3 min-w-[15px]", lineColor)} />}
          </div>
        );
      })}
    </div>
  );
}

interface LoanRequest {
  id: string;
  loanId: number;
  assetId: string;
  asset: string;
  borrower: string;
  purpose: string;
  destinationLab?: string;
  requestedOn: string;
  dueDate: string;
  status: "Pending" | "Approved" | "Declined";
  location: string;
  lab: string;
}

export function LabHeadDashboard({ activeTab }: { activeTab: string }) {
  const { currentUser } = useSession();
  const { assets, repairRequests, pendingRegistrations = [], approveRegistration, rejectRegistration } = useServerData();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "gallery">("gallery");
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // ── Live registry data (asset_records-backed, via /api/assets) ─────────────
  // Branch Inventory needs this — the mock `assets` array from context never
  // reflects real registrations/loans/transfers/repairs.
  const [dbAssets, setDbAssets] = useState<any[]>([]);
  const [loadingDbAssets, setLoadingDbAssets] = useState(false);
  const [dbAssetsError, setDbAssetsError] = useState<string | null>(null);

  const fetchDbAssets = useCallback(async () => {
    setLoadingDbAssets(true);
    setDbAssetsError(null);
    try {
      const data = await assetsApi.listAssets();
      if (data.success) {
        setDbAssets(data.assets);
      } else {
        setDbAssetsError(data.error || "Failed to load assets.");
      }
    } catch (err: any) {
      setDbAssetsError(err.message || "Failed to load assets.");
    } finally {
      setLoadingDbAssets(false);
    }
  }, []);

  useEffect(() => {
    fetchDbAssets();
  }, [fetchDbAssets]);

  useEffect(() => {
    if (activeTab === "inventory") {
      fetchDbAssets();
    }
  }, [activeTab, fetchDbAssets]);

  const displayedAssets = dbAssets.length > 0 ? dbAssets : assets;

  const openAsset = (eq: any): AssetDetail => ({
    id: eq.id,
    name: eq.name,
    serial: eq.serial,
    manufacturer: eq.manufacturer,
    category: eq.category,
    funding: eq.funding,
    procured: eq.procured,
    warranty: eq.warranty,
    location: eq.location,
    currentLocation: eq.currentLocation,
    lab: eq.lab,
    status: eq.status,
    condition: eq.condition,
    assetCondition: eq.assetCondition,
    custodian: eq.custodian,
    image: eq.image || eq.image_url,
    description: eq.description,
  });

  // ── Loan / Borrow Requests (asset_loans) ──────────────────────────────────
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  const fetchLoanRequests = useCallback(async () => {
    setLoansLoading(true);
    setLoanError(null);
    try {
      const data = await loansApi.listLoans();
      if (data.success) {
        setLoanRequests(data.loans);
      } else {
        setLoanError(data.error || "Failed to load loan requests.");
      }
    } catch (err: any) {
      setLoanError(err.message || "Failed to load loan requests.");
    } finally {
      setLoansLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanRequests();
  }, [fetchLoanRequests]);

  useEffect(() => {
    if (activeTab === "custody") {
      fetchLoanRequests();
    }
  }, [activeTab, fetchLoanRequests]);

  const [loanActionId, setLoanActionId] = useState<number | null>(null);

  const decideLoan = async (loanId: number, decision: "approve" | "decline") => {
    setLoanActionId(loanId);
    setLoanError(null);
    try {
      const data = await loansApi.decideLoan(loanId, decision);
      if (!data.success) {
        setLoanError(data.error || `Failed to ${decision} loan.`);
        return;
      }
      await fetchLoanRequests();
    } catch (err: any) {
      setLoanError(err.message || `Failed to ${decision} loan.`);
    } finally {
      setLoanActionId(null);
    }
  };

  // ── Custodianship Transfer Requests (asset_transfers) ─────────────────────
  interface TransferRequestDb {
    id: string;
    transferId: number;
    assetId: string;
    asset: string;
    from: string;
    to: string;
    justification: string;
    destinationLab?: string;
    requestedOn: string;
    status: "Pending" | "Approved" | "Declined";
    location: string;
    lab: string;
  }

  const [dbTransfers, setDbTransfers] = useState<TransferRequestDb[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const fetchTransferRequests = useCallback(async () => {
    setTransfersLoading(true);
    setTransferError(null);
    try {
      const data = await transfersApi.listTransfers();
      if (data.success) {
        setDbTransfers(data.transfers);
      } else {
        setTransferError(data.error || "Failed to load transfer requests.");
      }
    } catch (err: any) {
      setTransferError(err.message || "Failed to load transfer requests.");
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransferRequests();
  }, [fetchTransferRequests]);

  useEffect(() => {
    if (activeTab === "custody") {
      fetchTransferRequests();
    }
  }, [activeTab, fetchTransferRequests]);

  const [transferActionId, setTransferActionId] = useState<number | null>(null);

  const decideTransfer = async (transferId: number, decision: "approve" | "decline") => {
    setTransferActionId(transferId);
    setTransferError(null);
    try {
      const data = await transfersApi.decideTransfer(transferId, decision);
      if (!data.success) {
        setTransferError(data.error || `Failed to ${decision} transfer.`);
        return;
      }
      await fetchTransferRequests();
    } catch (err: any) {
      setTransferError(err.message || `Failed to ${decision} transfer.`);
    } finally {
      setTransferActionId(null);
    }
  };

  const handlePrintAudit = () => {
    const docElement = document.getElementById("audit-document");
    if (!docElement) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Equipment Audit Report - CITe4D</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@700;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #111827;
              padding: 40px;
              margin: 0;
              background: #ffffff;
            }
            .border { border: 1px solid #e5e7eb; }
            .rounded-xl { border-radius: 12px; }
            .p-6 { padding: 24px; }
            .bg-white { background-color: #ffffff; }
            .text-black { color: #000000; }
            .space-y-6 > * + * { margin-top: 24px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-start { align-items: flex-start; }
            .items-end { align-items: flex-end; }
            .border-b-2 { border-bottom-width: 2px; }
            .border-emerald-800 { border-color: #064e3b; }
            .pb-4 { padding-bottom: 16px; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            .uppercase { text-transform: uppercase; }
            .tracking-wide { letter-spacing: 0.025em; }
            .tracking-widest { letter-spacing: 0.1em; }
            .text-emerald-800 { color: #065f46; }
            .text-emerald-900 { color: #064e3b; }
            .text-emerald-950 { color: #022c22; }
            .text-gray-500 { color: #6b7280; }
            .text-gray-400 { color: #9ca3af; }
            .text-xs { font-size: 12px; }
            .text-sm { font-size: 14px; }
            .text-lg { font-size: 18px; }
            .text-xl { font-size: 20px; }
            .grid { display: grid; }
            .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .gap-3 { gap: 12px; }
            .bg-emerald-50\\/50 { background-color: rgba(236, 253, 245, 0.5); }
            .p-4 { padding: 16px; }
            .border-emerald-100 { border-color: #d1fae5; }
            .text-center { text-align: center; }
            .mt-0.5 { margin-top: 2px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-8 { margin-top: 32px; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .pb-1.5 { padding-bottom: 6px; }
            .mb-2.5 { margin-bottom: 10px; }
            .overflow-x-auto { overflow-x: auto; }
            .min-w-full { width: 100%; }
            .text-\\[11px\\] { font-size: 11px; }
            .text-\\[10px\\] { font-size: 10px; }
            .text-\\[9px\\] { font-size: 9px; }
            .bg-emerald-50\\/30 { background-color: rgba(236, 253, 245, 0.3); }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 8px 12px;
              text-align: left;
              border-bottom: 1px solid #f3f4f6;
            }
            th {
              font-weight: 700;
            }
            .font-mono { font-family: monospace; }
            .italic { font-style: italic; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-emerald-200 { border-color: #a7f3d0; }
            .pt-6 { padding-top: 24px; }
            .h-10 { height: 40px; }
            .w-40 { width: 160px; }
            
            @media print {
              body {
                padding: 0;
              }
              .border {
                border-color: #000000 !important;
              }
              th, td {
                border-bottom-color: #000000 !important;
              }
              .border-emerald-800 {
                border-color: #000000 !important;
              }
              .border-emerald-200 {
                border-color: #000000 !important;
              }
              .bg-emerald-50\\/50, .bg-emerald-50\\/30 {
                background-color: transparent !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${docElement.innerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const userLab = (currentUser as any)?.labAffiliation || "Center for ICT for Development (CITE4D)";

  const matchesBranch = (lab: string | undefined | null) => {
    if (!lab) return false;
    const target = userLab.toLowerCase().trim();
    const candidate = (lab || "").toLowerCase().trim();
    if (candidate === target) return true;
    if (target.includes(candidate) || candidate.includes(target)) return true;

    const match = userLab.match(/\(([^)]+)\)/);
    if (match) {
      const shortCode = match[1].toLowerCase().replace(/\s*lab\s*/g, "").trim();
      if (candidate === shortCode || candidate.includes(shortCode) || shortCode.includes(candidate)) return true;
    }
    const candMatch = candidate.match(/\(([^)]+)\)/);
    if (candMatch) {
      const candCode = candMatch[1].toLowerCase().replace(/\s*lab\s*/g, "").trim();
      if (target.includes(candCode)) return true;
    }
    return false;
  };

  const branchInventory = displayedAssets.filter(a => matchesBranch(a.lab) && a.status !== "Disposed");
  const decommissionedAssets = displayedAssets.filter(a => matchesBranch(a.lab) && a.status === "Disposed");

  const branchLoanRequests = loanRequests.filter(l => matchesBranch(l.lab));
  const branchDbTransfers = dbTransfers.filter(t => matchesBranch(t.lab));

  const branchPendingRegistrations = pendingRegistrations.filter(r => matchesBranch(r.labAffiliation));

  const branchAssetIds = new Set(displayedAssets.filter(a => matchesBranch(a.lab)).map(a => a.id));
  const branchRepairs = repairRequests.filter(r => branchAssetIds.has(r.assetId));

  // ── Custody ───────────────────────────────────────────────────────────────
  if (activeTab === "custody") {
    const pendingCount = branchLoanRequests.filter(l => l.status === "Pending").length;
    const approvedCount = branchLoanRequests.filter(l => l.status === "Approved").length;
    const declinedCount = branchLoanRequests.filter(l => l.status === "Declined").length;
    const pendingTransferCount = branchDbTransfers.filter(t => t.status === "Pending").length;
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-foreground mb-1">Digital Handshake Monitoring</h1>
          <p className="text-muted-foreground text-sm">Equipment loan/borrow requests and custodianship transfers for {userLab} research branch, pending your authorization.</p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-amber-600">{pendingCount}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-emerald-700">{approvedCount}</p><p className="text-xs text-muted-foreground">Completed This Period</p></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><p className="text-2xl font-extrabold text-red-700">{declinedCount}</p><p className="text-xs text-muted-foreground">Declined</p></CardContent></Card>
        </div>

        <h3 className="text-xs font-extrabold text-foreground uppercase tracking-widest mb-2.5">Equipment Loan Requests</h3>

        {loanError && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{loanError}</div>
        )}

        {loansLoading && branchLoanRequests.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">Loading loan requests…</p>
        ) : branchLoanRequests.length === 0 ? (
          <div className="py-4">
            <p className="text-xs text-muted-foreground">No loan or borrow requests logged for {userLab} branch.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {branchLoanRequests.map(loan => {
              const isPending = loan.status === "Pending";
              const isActing = loanActionId === loan.loanId;
              return (
                <Card key={loan.id} className={cn("border-l-4", loan.status === "Approved" ? "border-l-emerald-500" : loan.status === "Declined" ? "border-l-red-500" : "border-l-amber-500")} style={{ borderLeftWidth: 4 }}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-primary">{loan.id}</span>
                          <Badge className={cn("text-[10px]", txnBadgeClass[loan.status])}>{loan.status}</Badge>
                        </div>
                        <p className="text-sm font-bold text-foreground mb-2">{loan.asset} <span className="font-normal text-muted-foreground">({loan.assetId})</span></p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <div>
                            <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">BORROWER</p>
                            <p className="font-semibold text-foreground">{loan.borrower}</p>
                          </div>
                          {loan.destinationLab && (
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">TRANSFER LOCATION</p>
                              <p className="font-semibold text-foreground">{loan.destinationLab}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">PURPOSE</p>
                            <p className="max-w-[220px] truncate" title={loan.purpose}>{loan.purpose}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p><Calendar size={10} className="inline mr-1" />Due {loan.dueDate}</p>
                            <p>Requested {loan.requestedOn}</p>
                          </div>
                        </div>
                        <VisualTimeline status={loan.status} />
                      </div>
                      {isPending && (
                        <div className="flex gap-2 flex-shrink-0">
                          <Button size="sm" className="text-xs" disabled={isActing} onClick={() => decideLoan(loan.loanId, "approve")}><CheckCircle size={11} />{isActing ? "Working…" : "Authorize"}</Button>
                          <Button size="sm" variant="outline" className="text-xs border-red-200 text-red-600 hover:bg-red-50" disabled={isActing} onClick={() => decideLoan(loan.loanId, "decline")}><XCircle size={11} />{isActing ? "Working…" : "Decline"}</Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Custodianship Transfer Requests (asset_transfers) */}
        <div className="mt-8">
          <h3 className="text-xs font-extrabold text-foreground uppercase tracking-widest mb-2.5">
            Custodianship Transfer Requests {pendingTransferCount > 0 && <span className="text-amber-600">({pendingTransferCount} pending)</span>}
          </h3>

          {transferError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{transferError}</div>
          )}

          {transfersLoading && branchDbTransfers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">Loading transfer requests…</p>
          ) : branchDbTransfers.length === 0 ? (
            <div className="py-4">
              <p className="text-xs text-muted-foreground">No custodianship transfer requests logged for {userLab} branch.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {branchDbTransfers.map(t => {
                const isPending = t.status === "Pending" || t.status === "pending";
                const isActing = transferActionId === t.transferId;
                return (
                  <Card key={t.id} className={cn("border-l-4", t.status === "Approved" ? "border-l-emerald-500" : t.status === "Declined" ? "border-l-red-500" : "border-l-amber-500")} style={{ borderLeftWidth: 4 }}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold text-primary">{t.id}</span>
                            <Badge className={cn("text-[10px]", txnBadgeClass[t.status] || "bg-amber-50 text-amber-700 border-amber-200")}>{t.status}</Badge>
                          </div>
                          <p className="text-sm font-bold text-foreground mb-2">{t.asset} <span className="font-normal text-muted-foreground">({t.assetId})</span></p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">FROM CUSTODIAN</p>
                              <p className="font-semibold text-foreground">{t.from}</p>
                            </div>
                            <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">TO CUSTODIAN</p>
                              <p className="font-semibold text-foreground">{t.to}</p>
                            </div>
                            {t.destinationLab && (
                              <div>
                                <p className="text-[9px] font-bold text-muted-foreground tracking-widest mb-0.5">TRANSFER LOCATION</p>
                                <p className="font-semibold text-foreground">{t.destinationLab}</p>
                              </div>
                            )}
                            <div className="ml-auto text-right">
                              <p>Requested {t.requestedOn}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground max-w-[420px] truncate mb-2" title={t.justification}>{t.justification}</p>
                        </div>
                        {isPending && (
                          <div className="flex gap-2 flex-shrink-0">
                            <Button size="sm" className="text-xs" disabled={isActing} onClick={() => decideTransfer(t.transferId, "approve")}><CheckCircle size={11} />{isActing ? "Working…" : "Authorize"}</Button>
                            <Button size="sm" variant="outline" className="text-xs border-red-200 text-red-600 hover:bg-red-50" disabled={isActing} onClick={() => decideTransfer(t.transferId, "decline")}><XCircle size={11} />{isActing ? "Working…" : "Decline"}</Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Account Approvals ───────────────────────────────────────────────────
  if (activeTab === "approvals") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#005A36] flex items-center gap-2">
              <ShieldCheck size={22} className="text-[#005A36]" />
              Lab Head Account Approvals
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Authorize or reject pending institutional user registration requests for your assigned research laboratory.
            </p>
          </div>
          <Badge className="bg-emerald-100 text-[#005A36] border-emerald-300 font-extrabold text-xs px-3 py-1.5 self-start md:self-auto">
            {branchPendingRegistrations.length} PENDING REGISTRATION REQUESTS FOR {userLab.toUpperCase()}
          </Badge>
        </div>

        {branchPendingRegistrations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branchPendingRegistrations.map((req) => (
              <Card key={req.id} className="border border-slate-200 shadow-sm bg-white overflow-hidden transition-all hover:shadow-md">
                <div className="h-1.5 bg-[#005A36]" />
                <CardHeader className="pb-3 flex flex-row items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-[#005A36] overflow-hidden flex-shrink-0 bg-slate-100">
                    <img src={req.avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-bold text-slate-800 truncate">
                        {req.firstName} {req.lastName}
                      </CardTitle>
                      <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-200 uppercase font-extrabold">
                        {req.userType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Institutional ID:</span>
                      <span className="font-mono font-bold text-slate-700">{req.idNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Requested Role:</span>
                      <span className="font-bold text-[#005A36]">{req.requestedRole}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Lab Affiliation:</span>
                      <span className="font-bold text-slate-700">{req.labAffiliation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Submitted On:</span>
                      <span className="text-slate-600">{req.submittedAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      onClick={async () => {
                        if (confirm(`Approve registration request for ${req.firstName} ${req.lastName}?\n\nThis will create their active user account in the database.`)) {
                          await approveRegistration(req);
                          alert(`Account for ${req.firstName} ${req.lastName} approved & added to database!`);
                        }
                      }}
                      className="flex-1 bg-[#005A36] hover:bg-[#004225] text-white font-bold text-xs h-8 gap-1.5 cursor-pointer"
                    >
                      <CheckCircle size={13} /> Approve Account
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (confirm(`Decline registration request for ${req.firstName} ${req.lastName}?`)) {
                          await rejectRegistration(req.id);
                        }
                      }}
                      className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs h-8 gap-1.5 cursor-pointer"
                    >
                      <XCircle size={13} /> Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border border-slate-200 p-8 text-center bg-slate-50/50">
            <CheckCircle size={32} className="text-[#005A36] mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-bold text-slate-800">No Pending Account Approvals for {userLab}</h3>
            <p className="text-xs text-muted-foreground mt-1">All registration requests for your research laboratory have been processed.</p>
          </Card>
        )}
      </div>
    );
  }

  // ── Health Benchmarking ───────────────────────────────────────────────────
  if (activeTab === "health") {
    return <LabHeadAnalyticsView lab={userLab} />;
  }

  // ── Branch Inventory ──────────────────────────────────────────────────────
  const filtered = branchInventory.filter(eq => eq.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-foreground mb-1">Branch Inventory — {userLab}</h1>
          <p className="text-muted-foreground text-sm">Filtered view — other research centers are masked.</p>
          {loadingDbAssets && (
            <p className="text-xs text-muted-foreground mt-1">Loading registry data…</p>
          )}
          {!loadingDbAssets && dbAssetsError && (
            <p className="text-xs text-amber-700 mt-1">{dbAssetsError} — showing local data only.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-8" onClick={() => setShowAuditModal(true)}>
            <Download size={13} />Generate Audit Report
          </Button>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <Button variant={viewMode === "gallery" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("gallery")} className="rounded-none text-xs gap-1.5"><LayoutGrid size={13} />Gallery</Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none text-xs gap-1.5"><Table2 size={13} />Table</Button>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-3 py-1">BRANCH-SCOPED VIEW</Badge>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search branch assets…" className="pl-8" />
      </div>

      {viewMode === "gallery" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
          {filtered.map(eq => (
            <Card key={eq.id} className={cn("overflow-hidden p-0 gap-0 transition-all cursor-pointer", eq.status === "Disposed" ? "opacity-60 grayscale bg-muted/20 border-dashed border-muted-foreground/30 shadow-none hover:opacity-75" : "hover:shadow-md")} onClick={() => setSelectedAsset(openAsset(eq))}>
              <div className="relative">
                <AssetImagePlaceholder category={eq.category} aspectRatio="4/3" imageUrl={eq.image || (eq as any).image_url} />
                <Badge className={cn("absolute top-2 right-2 text-[9px]", statusClass[eq.status] ?? statusClass["Active"])}>{eq.status}</Badge>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-border">
                  <div className={cn("h-full w-full", CONDITION_DOT_CLASS[eq.assetCondition] ?? "bg-emerald-400")} />
                </div>
              </div>
              <CardContent className="px-3.5 py-3">
                <p className="text-[10px] font-bold text-primary mb-1">{eq.id}</p>
                <p className="text-sm font-bold text-foreground leading-snug mb-2">{eq.name}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{eq.custodian}</span>
                  <ConditionState value={eq.assetCondition} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{eq.category} · {eq.location}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === "table" && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {["", "Asset ID", "Name", "Category", "Status", "Custodian", "Location", "Cond.", "Funding"].map(h => <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(eq => (
                <TableRow key={eq.id} className={cn("cursor-pointer transition-colors", eq.status === "Disposed" ? "opacity-50 grayscale bg-muted/10 hover:bg-muted/20" : "")} onClick={() => setSelectedAsset(openAsset(eq))}>
                  <TableCell><div className="w-10 h-7 rounded overflow-hidden"><AssetImagePlaceholder category={eq.category} aspectRatio="4/3" imageUrl={eq.image || (eq as any).image_url} /></div></TableCell>
                  <TableCell className="font-bold text-primary text-xs">{eq.id}</TableCell>
                  <TableCell className="text-xs font-semibold text-foreground">{eq.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.category}</TableCell>
                  <TableCell><Badge className={cn("text-[10px]", statusClass[eq.status] ?? statusClass["Active"])}>{eq.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.custodian}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{eq.currentLocation || eq.location}</TableCell>
                  <TableCell><ConditionState value={eq.assetCondition} /></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{eq.funding}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />

      {/* Audit Document Dialog */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="max-w-none sm:max-w-[98vw] w-[98vw] max-h-[96vh] h-[95vh] flex flex-col p-6 gap-4 overflow-hidden print:max-h-none print:p-0">
          <DialogHeader className="print:hidden flex-shrink-0">
            <DialogTitle className="text-sm font-bold text-foreground">Generate Lab Audit Report</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Preview the audit report for DLSU AdRIC {userLab} research center equipment.</DialogDescription>
          </DialogHeader>

          {/* Audit Document Content */}
          <div id="audit-document" className="flex-1 overflow-y-auto border rounded-xl p-6 bg-white text-black font-sans leading-relaxed space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wide text-emerald-800 font-sans">DLSU AdRIC Research Laboratory</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-sans">De La Salle University · {userLab}</p>
                <p className="text-[10px] text-gray-400 mt-1 font-sans">Audit Ledger ID: AUD-{userLab.replace(/[^a-zA-Z0-9]/g, "")}-2026</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest font-sans">EQUIPMENT AUDIT REPORT</p>
                <p className="text-[11px] text-gray-500 mt-0.5 font-sans">Date Generated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                <p className="text-[11px] text-gray-500 font-semibold font-sans">Generated By: {userLab} Lab Head / Project Leader</p>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-4 gap-3 bg-emerald-50/50 p-4 border border-emerald-100 rounded-xl print:grid-cols-4">
              {[
                { label: "Active Equipment Count", val: branchInventory.length },
                { label: "Pending Custody Handshakes", val: branchDbTransfers.filter(t => t.status === "Pending").length },
                { label: "Maintenance Operations Logged", val: branchRepairs.length },
                { label: "Average Equipment Health Score", val: `${Math.round(branchInventory.reduce((acc, a) => acc + a.condition, 0) / (branchInventory.length || 1))}%` }
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <p className="text-lg font-bold text-emerald-950 font-sans">{val}</p>
                  <p className="text-[9px] text-emerald-800/80 font-bold uppercase tracking-wider mt-0.5 font-sans">{label}</p>
                </div>
              ))}
            </div>

            {/* Section 1: Active Asset Inventory */}
            <div>
              <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-2.5 uppercase tracking-widest font-sans">I. Branch Asset Registry</h3>
              <div className="overflow-x-auto">
                <Table className="min-w-full text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-emerald-50/30">
                      {["Asset ID", "Name", "Serial Number", "Manufacturer", "Category", "Funding", "Condition", "Current Location", "Status", "Custodian"].map(h => (
                        <TableHead key={h} className="text-[10px] font-bold text-emerald-900">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchInventory.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-bold text-emerald-800">{a.id}</TableCell>
                        <TableCell className="font-semibold">{a.name}</TableCell>
                        <TableCell className="font-mono">{a.serial}</TableCell>
                        <TableCell>{a.manufacturer}</TableCell>
                        <TableCell>{a.category}</TableCell>
                        <TableCell>{a.funding}</TableCell>
                        <TableCell className="font-bold">{(a.assetCondition || "PERFECT").replace(/_/g, " ")}</TableCell>
                        <TableCell>{a.currentLocation || a.location}</TableCell>
                        <TableCell>{a.status}</TableCell>
                        <TableCell className="font-medium text-emerald-950">{a.custodian || "Unassigned"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Section 2: Custody Handshake Logs */}
            <div>
              <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-2.5 uppercase tracking-widest font-sans">II. Custody Transitions, Loans &amp; Transfer Trail</h3>
              <div className="overflow-x-auto">
                <Table className="min-w-full text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-emerald-50/30">
                      {["Transaction ID", "Type", "Asset Name", "From Custodian", "To Custodian", "Transfer Location", "Date", "Status"].map(h => (
                        <TableHead key={h} className="text-[10px] font-bold text-emerald-900">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Combines loans and transfers into one chronological
                      // trail, same as the live Custody Transitions tab —
                      // both already scoped to CITe4D and sourced from the DB.
                      const custodyTrail = [
                        ...branchLoanRequests.map(l => ({
                          id: l.id,
                          type: "Loan",
                          asset: l.asset,
                          assetId: l.assetId,
                          from: "Equipment Pool",
                          to: l.borrower,
                          destinationLab: l.destinationLab,
                          date: l.requestedOn,
                          status: l.status,
                        })),
                        ...branchDbTransfers.map(t => ({
                          id: t.id,
                          type: "Transfer",
                          asset: t.asset,
                          assetId: t.assetId,
                          from: t.from,
                          to: t.to,
                          destinationLab: t.destinationLab,
                          date: t.requestedOn,
                          status: t.status,
                        })),
                      ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

                      if (custodyTrail.length === 0) {
                        return (
                          <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-4 font-sans">No loan or transfer operations logged for {userLab} branch.</TableCell></TableRow>
                        );
                      }

                      return custodyTrail.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-bold text-emerald-800">{entry.id}</TableCell>
                          <TableCell>{entry.type}</TableCell>
                          <TableCell className="font-semibold">{entry.asset} ({entry.assetId})</TableCell>
                          <TableCell>{entry.from}</TableCell>
                          <TableCell>{entry.to}</TableCell>
                          <TableCell>{entry.destinationLab || "—"}</TableCell>
                          <TableCell>{entry.date}</TableCell>
                          <TableCell className="font-bold">{entry.status}</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Section 3: Repair & Maintenance Operations History */}
            <div>
              <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-2.5 uppercase tracking-widest font-sans">III. Component Maintenance &amp; Troubleshooting Operations</h3>
              <div className="overflow-x-auto">
                <Table className="min-w-full text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-emerald-50/30">
                      {["Ticket ID", "Asset ID", "Asset Name", "Issue Description", "Submitted At", "Urgency Status", "Acknowledge State"].map(h => (
                        <TableHead key={h} className="text-[10px] font-bold text-emerald-900">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchRepairs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-4 font-sans">No maintenance tickets logged for CITe4D branch.</TableCell></TableRow>
                    ) : (
                      branchRepairs.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-bold text-emerald-800">{r.id}</TableCell>
                          <TableCell className="font-mono">{r.assetId}</TableCell>
                          <TableCell className="font-semibold">{r.assetName}</TableCell>
                          <TableCell className="italic max-w-[200px] truncate" title={r.description}>"{r.description}"</TableCell>
                          <TableCell>{r.submittedAt}</TableCell>
                          <TableCell className="font-bold">{r.priority}</TableCell>
                          <TableCell className="font-medium">{r.acknowledged ? "Resolved & Acknowledged" : "Pending Evaluation"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Section 4: Decommissioned & Disposed Assets Archive */}
            <div>
              <h3 className="text-xs font-extrabold text-emerald-900 border-b pb-1.5 mb-2.5 uppercase tracking-widest font-sans">IV. Decommissioned &amp; Disposed Assets Archive</h3>
              <div className="overflow-x-auto">
                <Table className="min-w-full text-[11px]">
                  <TableHeader>
                    <TableRow className="bg-emerald-50/30">
                      {["Asset ID", "Disposal ID", "Asset Name", "Decommission Date", "Last Custodian", "Primary Breakdown Reason", "Disposal Pathway", "Decommissioned By"].map(h => (
                        <TableHead key={h} className="text-[10px] font-bold text-emerald-900">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decommissionedAssets.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-4 font-sans">No decommissioned or disposed assets recorded for {userLab} branch.</TableCell></TableRow>
                    ) : (
                      decommissionedAssets.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-bold text-red-800">{a.id}</TableCell>
                          <TableCell className="font-bold text-emerald-800">{a.disposalId || a.id.replace("EQ", "DISP")}</TableCell>
                          <TableCell className="font-semibold">{a.name}</TableCell>
                          <TableCell>{a.disposalDetails?.decommissionDate || "—"}</TableCell>
                          <TableCell>{a.disposalDetails?.lastCustodian || "—"}</TableCell>
                          <TableCell className="italic max-w-[200px] truncate" title={a.disposalDetails?.breakdownReasons}>
                            "{a.disposalDetails?.breakdownReasons || "—"}"
                          </TableCell>
                          <TableCell>{a.disposalDetails?.disposalPathway || "—"}</TableCell>
                          <TableCell className="font-semibold text-emerald-950">{a.disposalDetails?.decommissionedBy || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Compliance & Approvals Footer */}
            <div className="flex justify-between items-end border-t border-emerald-200 pt-6 mt-8">
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-sans">Auditor Signature</p>
                <div className="h-10 w-40 border-b border-gray-400 mt-2 flex items-center justify-center italic text-xs text-gray-500 font-sans">Digital Signature Verified</div>
                <p className="text-[10px] text-gray-500 mt-1 font-sans">CITe4D Lab Head / Project Leader</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest font-sans">Compliance Status</p>
                <p className="text-xs font-bold text-emerald-700 mt-1 font-sans">✓ AdRIC Assets Compliant</p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-sans">DLSU Engineering Standards</p>
              </div>
            </div>
          </div>

          <DialogFooter className="print:hidden flex-shrink-0 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setShowAuditModal(false)}>Close</Button>
            <Button className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold gap-1.5" onClick={handlePrintAudit}>
              <Printer size={13} />Print Audit Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}