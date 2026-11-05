/**
 * Lab Head screen tab: Equipment loan requests and out-on-loan custody tracking.
 * Layer: feature component. Called by pages/lab-head/LabHeadDashboard.tsx when activeTab === "custody".
 * Calls: api/loans.api.ts (listLabRequests, approveLoan, declineLoan).
 * Used by: Lab Head to approve/decline loan requests for their lab and monitor equipment out on loan.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  ArrowUpRight,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  Search,
  RefreshCw,
} from "lucide-react";
import * as loansApi from "@web/api/loans.api";
import type { Loan } from "./loanTypes";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent } from "@web/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@web/components/ui/dialog";
import { Textarea } from "@web/components/ui/textarea";
import { Label } from "@web/components/ui/label";
import { cn } from "@web/components/ui/utils";

interface LabHeadLoanRequestsProps {
  userLab: string;
}

const statusBadgeClasses: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_RELEASE: "bg-blue-50 text-blue-700 border-blue-200",
  ON_LOAN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RETURN_REQUESTED: "bg-purple-50 text-purple-700 border-purple-200",
  RETURNED: "bg-slate-50 text-slate-700 border-slate-200",
  DECLINED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-300",
};

/**
 * Renders the Lab Head Requests tab with two sub-views:
 * 1. Requests: Pending Approval requests waiting for decision.
 * 2. Out on Loan: Approved loans waiting for release, active loans, and requested returns.
 */
export function LabHeadLoanRequests({ userLab }: LabHeadLoanRequestsProps) {
  const [activeSubTab, setActiveSubTab] = useState<"requests" | "out">("requests");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modal states for decision
  const [decisionLoan, setDecisionLoan] = useState<Loan | null>(null);
  const [decisionType, setDecisionType] = useState<"approve" | "decline" | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loansApi.listLabRequests();
      if (!res.success) {
        setError(res.error || "Failed to load lab loan requests.");
        return;
      }
      setLoans((res.loans as Loan[]) || []);
    } catch (err: any) {
      setError(err?.message || "Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const pendingRequests = loans.filter((l) => l.status === "PENDING_APPROVAL");
  const outOnLoan = loans.filter(
    (l) =>
      l.status === "PENDING_RELEASE" ||
      l.status === "ON_LOAN" ||
      l.status === "RETURN_REQUESTED"
  );

  const openDecisionModal = (loan: Loan, type: "approve" | "decline") => {
    setDecisionLoan(loan);
    setDecisionType(type);
    setDecisionRemarks("");
    setDecisionError(null);
  };

  const closeDecisionModal = () => {
    setDecisionLoan(null);
    setDecisionType(null);
    setDecisionRemarks("");
    setDecisionError(null);
  };

  const handleSubmitDecision = async () => {
    if (!decisionLoan || !decisionType) return;
    if (decisionType === "decline" && !decisionRemarks.trim()) {
      setDecisionError("Remarks are required when declining a request.");
      return;
    }

    setSubmitting(true);
    setDecisionError(null);
    try {
      const res =
        decisionType === "approve"
          ? await loansApi.approveLoan(decisionLoan.loanId, decisionRemarks.trim() || undefined)
          : await loansApi.declineLoan(decisionLoan.loanId, decisionRemarks.trim());

      if (!res.success) {
        setDecisionError(res.error || `Failed to ${decisionType} loan.`);
        return;
      }

      closeDecisionModal();
      await fetchRequests();
    } catch (err: any) {
      setDecisionError(err?.message || `Failed to ${decisionType} loan.`);
    } finally {
      setSubmitting(false);
    }
  };

  const matchesSearch = (loan: Loan) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const tag = loan.asset.tag.toLowerCase();
    const name = loan.asset.name.toLowerCase();
    const borrowerName =
      loan.borrower && "name" in loan.borrower ? loan.borrower.name.toLowerCase() : "";
    return tag.includes(q) || name.includes(q) || borrowerName.includes(q);
  };

  const filteredPending = pendingRequests.filter(matchesSearch);
  const filteredOut = outOnLoan.filter(matchesSearch);

  const overdueCount = outOnLoan.filter((l) => l.isOverdue).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-foreground text-xl font-bold mb-1">Loan Requests</h1>
          <p className="text-muted-foreground text-sm">
            Loan requests for {userLab || "your lab"}. Approve or decline pending requests and monitor equipment out on loan.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRequests}
          disabled={loading}
          className="gap-1.5 text-xs"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-extrabold text-amber-600">{pendingRequests.length}</p>
            <p className="text-xs text-muted-foreground">Waiting for Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-extrabold text-blue-600">{outOnLoan.length}</p>
            <p className="text-xs text-muted-foreground">Out on Loan / Releasing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className={cn("text-2xl font-extrabold", overdueCount > 0 ? "text-red-600" : "text-emerald-700")}>
              {overdueCount}
            </p>
            <p className="text-xs text-muted-foreground">Overdue Items</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Tab Switcher & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          <Button
            variant={activeSubTab === "requests" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSubTab("requests")}
            className="rounded-none text-xs gap-1.5 h-8 font-semibold"
          >
            <Clock size={13} />
            Requests ({pendingRequests.length})
          </Button>
          <Button
            variant={activeSubTab === "out" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveSubTab("out")}
            className="rounded-none text-xs gap-1.5 h-8 font-semibold"
          >
            <ArrowUpRight size={13} />
            Out on Loan ({outOnLoan.length})
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tag, name, borrower..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Requests Sub-tab */}
      {activeSubTab === "requests" && (
        <div>
          {loading && loans.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading pending requests...</p>
          ) : filteredPending.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              No pending loan requests for {userLab || "your lab"}.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPending.map((loan) => {
                const borrowerName =
                  loan.borrower && "name" in loan.borrower ? loan.borrower.name : "Borrower";
                const destLabCode = loan.destinationLab?.code ?? userLab;
                const destRoom = loan.destinationRoom ? ` (Room ${loan.destinationRoom})` : "";

                return (
                  <Card key={loan.loanId} className="border-l-4 border-l-amber-500 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-[16rem]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-primary">LOAN-{loan.loanId}</span>
                            <Badge className={cn("text-[10px]", statusBadgeClasses[loan.status] ?? "bg-muted")}>
                              {loan.statusLabel || "Pending Approval"}
                            </Badge>
                          </div>

                          <p className="text-sm font-bold text-foreground mb-2">
                            {loan.asset.name} <span className="font-normal text-muted-foreground">({loan.asset.tag})</span>
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground mb-3">
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 flex items-center gap-1">
                                <User size={10} /> Borrower
                              </p>
                              <p className="font-semibold text-foreground">{borrowerName}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 flex items-center gap-1">
                                <MapPin size={10} /> Destination
                              </p>
                              <p className="font-semibold text-foreground">
                                {destLabCode}
                                {destRoom}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 flex items-center gap-1">
                                <Calendar size={10} /> Return By
                              </p>
                              <p className="font-semibold text-foreground">{loan.returnBy}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5">
                                Requested On
                              </p>
                              <p className="font-medium text-foreground">
                                {loan.requestedAt ? new Date(loan.requestedAt).toLocaleDateString() : "—"}
                              </p>
                            </div>
                          </div>

                          <div className="bg-muted/30 rounded-md p-2.5 text-xs">
                            <span className="font-semibold text-foreground">Purpose: </span>
                            <span className="text-muted-foreground">{loan.purpose || "Not specified"}</span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                            onClick={() => openDecisionModal(loan, "approve")}
                          >
                            <CheckCircle size={13} />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1"
                            onClick={() => openDecisionModal(loan, "decline")}
                          >
                            <XCircle size={13} />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Out on Loan Sub-tab */}
      {activeSubTab === "out" && (
        <div>
          {loading && loans.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading out-on-loan items...</p>
          ) : filteredOut.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              No equipment currently out on loan from {userLab || "your lab"}.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOut.map((loan) => {
                const borrowerName =
                  loan.borrower && "name" in loan.borrower ? loan.borrower.name : "Borrower";
                const isReleased = loan.status === "ON_LOAN" || loan.status === "RETURN_REQUESTED" || Boolean(loan.releasedAt);

                return (
                  <Card
                    key={loan.loanId}
                    className={cn(
                      "border-l-4 overflow-hidden",
                      loan.isOverdue
                        ? "border-l-red-500"
                        : loan.status === "RETURN_REQUESTED"
                        ? "border-l-purple-500"
                        : loan.status === "ON_LOAN"
                        ? "border-l-emerald-500"
                        : "border-l-blue-500"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-[16rem]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-primary">LOAN-{loan.loanId}</span>
                            <Badge className={cn("text-[10px]", statusBadgeClasses[loan.status] ?? "bg-muted")}>
                              {loan.statusLabel}
                            </Badge>
                            {loan.isOverdue && (
                              <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 font-bold">
                                Overdue
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm font-bold text-foreground mb-2">
                            {loan.asset.name} <span className="font-normal text-muted-foreground">({loan.asset.tag})</span>
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground mb-3">
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 flex items-center gap-1">
                                <User size={10} /> Borrower
                              </p>
                              <p className="font-semibold text-foreground">{borrowerName}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 flex items-center gap-1">
                                <MapPin size={10} /> Destination
                              </p>
                              <p className="font-semibold text-foreground">
                                {loan.destinationLab?.code ?? "—"}
                                {loan.destinationRoom ? ` (Room ${loan.destinationRoom})` : ""}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 flex items-center gap-1">
                                <Calendar size={10} /> Return By
                              </p>
                              <p className={cn("font-semibold", loan.isOverdue ? "text-red-600 font-bold" : "text-foreground")}>
                                {loan.returnBy}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5">
                                Released Date
                              </p>
                              <p className="font-medium text-foreground">
                                {loan.releasedAt ? new Date(loan.releasedAt).toLocaleDateString() : "Pending Handover"}
                              </p>
                            </div>
                          </div>

                          <div className="bg-muted/30 rounded-md p-2.5 text-xs">
                            <span className="font-semibold text-foreground">Purpose: </span>
                            <span className="text-muted-foreground">{loan.purpose || "Not specified"}</span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2 flex-shrink-0">
                          {isReleased ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              onClick={() => window.open(`/loans/${loan.loanId}/accountability-form`, "_blank")}
                            >
                              <FileText size={13} />
                              Accountability Form
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic px-2 py-1">
                              Awaiting TSG Release
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Decision Dialog (Approve / Decline) */}
      <Dialog open={Boolean(decisionLoan)} onOpenChange={(open) => { if (!open) closeDecisionModal(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionType === "approve" ? "Approve Loan Request" : "Decline Loan Request"}
            </DialogTitle>
            <DialogDescription>
              {decisionLoan && (
                <span>
                  {decisionLoan.asset.name} ({decisionLoan.asset.tag}) for{" "}
                  {decisionLoan.borrower && "name" in decisionLoan.borrower
                    ? decisionLoan.borrower.name
                    : "Borrower"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {decisionError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5">
                {decisionError}
              </div>
            )}

            <div>
              <Label htmlFor="remarks" className="text-xs font-semibold">
                Decision Remarks {decisionType === "decline" && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="remarks"
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                placeholder={
                  decisionType === "approve"
                    ? "Optional notes or conditions..."
                    : "State why this loan request is declined..."
                }
                rows={3}
                className="mt-1.5 text-xs"
              />
              {decisionType === "decline" && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  A reason is required so the researcher knows why their request was declined.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeDecisionModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              className={cn(
                "text-xs",
                decisionType === "approve"
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
              onClick={handleSubmitDecision}
            >
              {submitting
                ? "Submitting..."
                : decisionType === "approve"
                ? "Confirm Approval"
                : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
