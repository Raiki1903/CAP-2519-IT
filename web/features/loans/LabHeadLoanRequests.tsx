/**
 * Lab Head screen tab: Equipment loan requests and out-on-loan custody tracking.
 * Layer: feature component. Called by pages/lab-head/LabHeadDashboard.tsx when activeTab === "custody".
 * Calls: api/loans.api.ts (listLabRequests, approveLoan, declineLoan), AccountabilityFormButton.tsx, loanStatusStyles.ts.
 * Used by: Lab Head to approve/decline loan requests for their lab and monitor equipment out on loan.
 */
import { useState, useEffect, useCallback } from "react";
import {
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
import type { Loan } from "@shared/types/loans";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Card, CardContent } from "@web/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@web/components/ui/tabs";
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
import { AccountabilityFormButton } from "@web/features/loans/AccountabilityFormButton";
import { loanCardAccentClass, loanStatusBadgeClass } from "@web/features/loans/loanStatusStyles";

interface LabHeadLoanRequestsProps {
  userLab: string;
}

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
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-foreground mb-1">Loan Requests</h1>
          <p className="text-muted-foreground text-sm">
            Loan requests for {userLab || "your lab"}. Approve or decline pending requests and monitor equipment out on loan.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-extrabold text-foreground">{pendingRequests.length}</p>
            <p className="text-xs text-muted-foreground">Waiting for Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-extrabold text-foreground">{outOnLoan.length}</p>
            <p className="text-xs text-muted-foreground">Out on Loan / Releasing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className={cn("text-2xl font-extrabold", overdueCount > 0 ? "text-destructive" : "text-foreground")}>
              {overdueCount}
            </p>
            <p className="text-xs text-muted-foreground">Overdue Items</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Tab Switcher & Search */}
      <Tabs value={activeSubTab} onValueChange={(val) => setActiveSubTab(val as "requests" | "out")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
            {([
              ["requests", "Requests", pendingRequests.length],
              ["out", "Out on Loan", outOnLoan.length],
            ] as const).map(([value, label, count]) => (
              <TabsTrigger key={value} value={value} className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
                {label}
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{count}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative mb-4 w-full sm:w-64">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tag, name, borrower..."
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>
      </Tabs>

      {/* Requests Sub-tab */}
      {activeSubTab === "requests" && (
        <div>
          {loading && loans.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading pending requests...</p>
          ) : filteredPending.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              No pending loan requests for {userLab || "your lab"}.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPending.map((loan) => {
                const borrowerName =
                  loan.borrower && "name" in loan.borrower ? loan.borrower.name : "Borrower";
                const destLabCode = loan.destinationLab?.code ?? userLab;
                const destRoom = loan.destinationRoom ? ` (Room ${loan.destinationRoom})` : "";

                return (
                  <Card key={loan.loanId} className={cn("border-l-4 overflow-hidden", loanCardAccentClass(loan.status, loan.isOverdue))}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-[16rem]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-primary">LOAN-{loan.loanId}</span>
                            <Badge variant="outline" className={cn("text-[10px]", loanStatusBadgeClass(loan.status))}>
                              {loan.statusLabel}
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
                                {loan.requestedAt ? new Date(loan.requestedAt).toLocaleDateString() : "N/A"}
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
                            className="text-xs gap-1"
                            onClick={() => openDecisionModal(loan, "approve")}
                          >
                            <CheckCircle size={13} />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1 border-destructive/30 text-destructive hover:text-destructive"
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
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              No equipment currently out on loan from {userLab || "your lab"}.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOut.map((loan) => {
                const borrowerName =
                  loan.borrower && "name" in loan.borrower ? loan.borrower.name : "Borrower";
                const isReleased = loan.status === "ON_LOAN" || loan.status === "RETURN_REQUESTED" || Boolean(loan.releasedAt);

                return (
                  <Card
                    key={loan.loanId}
                    className={cn("border-l-4 overflow-hidden", loanCardAccentClass(loan.status, loan.isOverdue))}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-[16rem]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-primary">LOAN-{loan.loanId}</span>
                            <Badge variant="outline" className={cn("text-[10px]", loanStatusBadgeClass(loan.status))}>
                              {loan.statusLabel}
                            </Badge>
                            {loan.isOverdue && (
                              <Badge variant="destructive" className="text-[10px] font-bold">
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
                                {loan.destinationLab?.code ?? "N/A"}
                                {loan.destinationRoom ? ` (Room ${loan.destinationRoom})` : ""}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mb-0.5 flex items-center gap-1">
                                <Calendar size={10} /> Return By
                              </p>
                              <p className={cn("font-semibold", loan.isOverdue ? "text-destructive font-bold" : "text-foreground")}>
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
<AccountabilityFormButton loanId={loan.loanId} />
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
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-2.5">
                {decisionError}
              </div>
            )}

            <div>
              <Label htmlFor="remarks" className="text-xs font-semibold">
                Decision Remarks {decisionType === "decline" && <span className="text-destructive">*</span>}
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
              variant={decisionType === "decline" ? "destructive" : "default"}
              disabled={submitting}
              className="text-xs"
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
