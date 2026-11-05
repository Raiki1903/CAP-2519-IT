/**
 * Researcher screen: My Loans tracking active borrowings, pending requests, and loan history.
 * Layer: feature component. Called by pages/custodian/CustodianPortal.tsx when activeTab === "myassets".
 * Calls: api/loans.api.ts (listMyLoans, cancelLoan, requestReturn), features/assets/AssetDetailModal.tsx (report an issue),
 * state/serverData.tsx (assets).
 * Used by: Researchers/Custodians to cancel requests, request returns, report an issue, and view their Accountability Forms.
 */
import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  ArrowUpRight,
  History,
  FileText,
  RotateCcw,
  Ban,
  AlertTriangle,
  Calendar,
  MapPin,
  Search,
  Wrench,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import * as loansApi from "@web/api/loans.api";
import type { Loan } from "@shared/types/loans";
import { AssetDetailModal } from "@web/features/assets/AssetDetailModal";
import { useServerData } from "@web/state/serverData";
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
 * Researcher My Loans component. Displays loans grouped by status:
 * 1. Waiting: Pending Approval and Pending Release. Supports Cancel action.
 * 2. Out: On Loan and Return Requested. Supports Ask to return, Report an issue, and Accountability Form view.
 * 3. History: Returned, Declined, and Cancelled loans.
 */
export function ResearcherMyLoans() {
  const { assets } = useServerData();
  const [activeTab, setActiveTab] = useState<"waiting" | "out" | "history">("out");
  // The tag of the asset whose detail is open. The detail's Request Repair opens the report form.
  const [detailTag, setDetailTag] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<Loan | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Return request dialog state
  const [returnTarget, setReturnTarget] = useState<Loan | null>(null);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [requestingReturn, setRequestingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const fetchMyLoans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loansApi.listMyLoans();
      if (!res.success) {
        setError(res.error || "Failed to load your loans.");
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
    fetchMyLoans();
  }, [fetchMyLoans]);

  const waitingLoans = loans.filter(
    (l) => l.status === "PENDING_APPROVAL" || l.status === "PENDING_RELEASE"
  );
  const outLoans = loans.filter(
    (l) => l.status === "ON_LOAN" || l.status === "RETURN_REQUESTED"
  );
  const historyLoans = loans.filter(
    (l) => l.status === "RETURNED" || l.status === "DECLINED" || l.status === "CANCELLED"
  );

  const matchesSearch = (loan: Loan) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const tag = loan.asset.tag.toLowerCase();
    const name = loan.asset.name.toLowerCase();
    const dest = loan.destinationLab?.code.toLowerCase() || "";
    return tag.includes(q) || name.includes(q) || dest.includes(q);
  };

  const filteredWaiting = waitingLoans.filter(matchesSearch);
  const filteredOut = outLoans.filter(matchesSearch);
  const filteredHistory = historyLoans.filter(matchesSearch);

  const overdueCount = outLoans.filter((l) => l.isOverdue).length;

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await loansApi.cancelLoan(cancelTarget.loanId);
      if (!res.success) {
        setCancelError(res.error || "Failed to cancel loan request.");
        return;
      }
      setCancelTarget(null);
      await fetchMyLoans();
    } catch (err: any) {
      setCancelError(err?.message || "Failed to cancel loan request.");
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmReturnRequest = async () => {
    if (!returnTarget) return;
    if (returnRemarks.length > 255) {
      setReturnError("Remarks cannot exceed 255 characters.");
      return;
    }
    setRequestingReturn(true);
    setReturnError(null);
    try {
      const res = await loansApi.requestReturn(returnTarget.loanId, returnRemarks.trim() || undefined);
      if (!res.success) {
        setReturnError(res.error || "Failed to submit return request.");
        return;
      }
      setReturnTarget(null);
      setReturnRemarks("");
      await fetchMyLoans();
    } catch (err: any) {
      setReturnError(err?.message || "Failed to submit return request.");
    } finally {
      setRequestingReturn(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-foreground text-xl font-bold mb-1">My Loans</h1>
          <p className="text-muted-foreground text-sm">
            Equipment you have borrowed, requests awaiting processing, and your past borrowing history.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMyLoans}
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
            <p className="text-2xl font-extrabold text-blue-600">{outLoans.length}</p>
            <p className="text-xs text-muted-foreground">Equipment in Custody</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-extrabold text-amber-600">{waitingLoans.length}</p>
            <p className="text-xs text-muted-foreground">Requests Waiting</p>
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

      {overdueCount > 0 && (
        <div className="rounded-xl p-3.5 mb-4 flex items-center gap-3 bg-red-50 border border-red-200">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700">
            <strong>Overdue Return:</strong> You have {overdueCount} overdue borrowed asset(s). Please return them to TSG immediately to prevent clearance delays.
          </p>
        </div>
      )}

      {/* Navigation tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-border">
          <Button
            variant={activeTab === "out" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("out")}
            className="rounded-none text-xs gap-1.5 h-8 font-semibold"
          >
            <ArrowUpRight size={13} />
            Out ({outLoans.length})
          </Button>
          <Button
            variant={activeTab === "waiting" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("waiting")}
            className="rounded-none text-xs gap-1.5 h-8 font-semibold"
          >
            <Clock size={13} />
            Waiting ({waitingLoans.length})
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="rounded-none text-xs gap-1.5 h-8 font-semibold"
          >
            <History size={13} />
            History ({historyLoans.length})
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tag, name, or lab..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Out on Loan Section */}
      {activeTab === "out" && (
        <div>
          {loading && loans.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading borrowed assets...</p>
          ) : filteredOut.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              You do not have any borrowed equipment currently in your custody.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOut.map((loan) => (
                <Card
                  key={loan.loanId}
                  className={cn(
                    "border-l-4 overflow-hidden",
                    loan.isOverdue
                      ? "border-l-red-500"
                      : loan.status === "RETURN_REQUESTED"
                      ? "border-l-purple-500"
                      : "border-l-emerald-500"
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

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground mb-3">
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
                              Handed Over On
                            </p>
                            <p className="font-medium text-foreground">
                              {loan.releasedAt ? new Date(loan.releasedAt).toLocaleDateString() : "—"}
                            </p>
                          </div>
                        </div>

                        {loan.purpose && (
                          <div className="bg-muted/30 rounded-md p-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Purpose: </span>
                            {loan.purpose}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col gap-2 flex-shrink-0">
                        {/* Ask to Return button on ON_LOAN */}
                        {loan.status === "ON_LOAN" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                            onClick={() => {
                              setReturnTarget(loan);
                              setReturnRemarks("");
                              setReturnError(null);
                            }}
                          >
                            <RotateCcw size={13} />
                            Ask to Return
                          </Button>
                        )}

                        {loan.status === "RETURN_REQUESTED" && (
                          <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2.5 py-1.5 flex items-center gap-1">
                            <Clock size={12} />
                            Return Requested
                          </span>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50"
                          disabled={!assets.some(a => a.id === loan.asset.tag)}
                          onClick={() => setDetailTag(loan.asset.tag)}
                        >
                          <Wrench size={13} />
                          Report an issue
                        </Button>

                        {/* Accountability Form link */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                          onClick={() => window.open(`/loans/${loan.loanId}/accountability-form`, "_blank")}
                        >
                          <FileText size={13} />
                          Accountability Form
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Waiting Section */}
      {activeTab === "waiting" && (
        <div>
          {loading && loans.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading waiting requests...</p>
          ) : filteredWaiting.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              You have no loan requests currently waiting for approval or release.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredWaiting.map((loan) => (
                <Card
                  key={loan.loanId}
                  className={cn(
                    "border-l-4 overflow-hidden",
                    loan.status === "PENDING_APPROVAL" ? "border-l-amber-500" : "border-l-blue-500"
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
                        </div>

                        <p className="text-sm font-bold text-foreground mb-2">
                          {loan.asset.name} <span className="font-normal text-muted-foreground">({loan.asset.tag})</span>
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground mb-3">
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
                            <p className="font-semibold text-foreground">{loan.returnBy}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5">
                              Status Detail
                            </p>
                            <p className="font-medium text-foreground">
                              {loan.status === "PENDING_APPROVAL"
                                ? "Awaiting Lab Head Approval"
                                : "Approved, Awaiting TSG Release"}
                            </p>
                          </div>
                        </div>

                        {loan.purpose && (
                          <div className="bg-muted/30 rounded-md p-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Purpose: </span>
                            {loan.purpose}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setCancelTarget(loan);
                            setCancelError(null);
                          }}
                        >
                          <Ban size={13} />
                          Cancel Request
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Section */}
      {activeTab === "history" && (
        <div>
          {loading && loans.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading borrowing history...</p>
          ) : filteredHistory.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              No previous borrowing history found.
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredHistory.map((loan) => (
                <Card key={loan.loanId} className="border-l-4 border-l-slate-300 overflow-hidden opacity-90">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-[16rem]">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-primary">LOAN-{loan.loanId}</span>
                          <Badge className={cn("text-[10px]", statusBadgeClasses[loan.status] ?? "bg-muted")}>
                            {loan.statusLabel}
                          </Badge>
                        </div>

                        <p className="text-sm font-bold text-foreground mb-1">
                          {loan.asset.name} <span className="font-normal text-muted-foreground">({loan.asset.tag})</span>
                        </p>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
                          <span>Return-by: {loan.returnBy}</span>
                          {loan.closedAt && <span>Closed: {new Date(loan.closedAt).toLocaleDateString()}</span>}
                        </div>

                        {loan.decisionRemarks && loan.status === "DECLINED" && (
                          <div className="mt-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded p-2">
                            <span className="font-semibold">Decline Reason: </span>
                            {loan.decisionRemarks}
                          </div>
                        )}
                      </div>

                      {loan.status === "RETURNED" && (
                        <div className="flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1"
                            onClick={() => window.open(`/loans/${loan.loanId}/accountability-form`, "_blank")}
                          >
                            <FileText size={12} />
                            View Record
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The asset detail, opened from Report an issue; its Request Repair button opens the report form. */}
      <AssetDetailModal asset={assets.find(a => a.id === detailTag) ?? null} onClose={() => setDetailTag(null)} />

      {/* Cancel Request Dialog */}
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Loan Request</DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <span>
                  Are you sure you want to cancel your request for {cancelTarget.asset.name} ({cancelTarget.asset.tag})?
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {cancelError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5">
              {cancelError}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Keep Request
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={cancelling}
              onClick={handleConfirmCancel}
            >
              {cancelling ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ask to Return Dialog */}
      <Dialog open={Boolean(returnTarget)} onOpenChange={(open) => { if (!open) setReturnTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ask to Return Equipment</DialogTitle>
            <DialogDescription>
              {returnTarget && (
                <span>
                  Notify TSG that you are ready to return {returnTarget.asset.name} ({returnTarget.asset.tag}).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {returnError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2.5">
                {returnError}
              </div>
            )}

            <div>
              <Label htmlFor="return-remarks" className="text-xs font-semibold">
                Return Remarks (optional)
              </Label>
              <Textarea
                id="return-remarks"
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
                placeholder="Mention equipment condition, returned accessories, or preferred drop-off time..."
                rows={3}
                maxLength={255}
                className="mt-1.5 text-xs"
              />
              <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1">
                <span>TSG will inspect the equipment upon handover.</span>
                <span>{returnRemarks.length} / 255</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReturnTarget(null)}
              disabled={requestingReturn}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={requestingReturn}
              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={handleConfirmReturnRequest}
            >
              {requestingReturn ? "Submitting..." : "Submit Return Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
