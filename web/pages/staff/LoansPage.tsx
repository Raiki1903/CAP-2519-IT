/**
 * Asset Loans page for TSG staff.
 * Layer: page. Called by app/routes.tsx at /staff/loans.
 * Calls: api/loans.api.ts listLoansByStatus(), LoanReleaseDialog, LoanReceiveDialog, loans/loanStatusStyles.ts.
 * Used by: TSG Staff.
 */
import { useEffect, useState, useMemo } from "react";
import { Search, CheckCircle2, AlertCircle, RefreshCw, Package, RotateCcw } from "lucide-react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import { useSession } from "@web/state/session";
import { listLoansByStatus } from "@web/api/loans.api";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { cn } from "@web/components/ui/utils";
import { LoanReleaseDialog } from "@web/features/loans/LoanReleaseDialog";
import { LoanReceiveDialog } from "@web/features/loans/LoanReceiveDialog";
import { loanStatusBadgeClass } from "@web/features/loans/loanStatusStyles";
import type { Loan } from "@shared/types/loans";

/**
 * Main Asset Loans management screen with Releases and Returns tabs.
 */
export function LoansPage() {
  const { role, currentUser } = useSession();

  const [activeTab, setActiveTab] = useState<"releases" | "returns" | "clearance">("releases");
  const [clearanceUserId, setClearanceUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [releases, setReleases] = useState<Loan[]>([]);
  const [returns, setReturns] = useState<Loan[]>([]);

  const [selectedReleaseLoan, setSelectedReleaseLoan] = useState<Loan | null>(null);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);

  const [selectedReturnLoan, setSelectedReturnLoan] = useState<Loan | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);

  const isTsg = role === "Staff" && currentUser?.staffUnit === "TSG";

  const loadData = async () => {
    if (!isTsg) return;
    setLoading(true);

    try {
      const [releasesRes, returnsRes] = await Promise.all([
        listLoansByStatus(["PENDING_RELEASE"]),
        listLoansByStatus(["RETURN_REQUESTED", "ON_LOAN"]),
      ]);

      if (releasesRes.success && Array.isArray(releasesRes.loans)) {
        setReleases(releasesRes.loans);
      }

      if (returnsRes.success && Array.isArray(returnsRes.loans)) {
        // Return Requested first, then On Loan
        const sortedReturns = [...(returnsRes.loans as Loan[])].sort((a, b) => {
          if (a.status === "RETURN_REQUESTED" && b.status !== "RETURN_REQUESTED") return -1;
          if (a.status !== "RETURN_REQUESTED" && b.status === "RETURN_REQUESTED") return 1;
          return new Date(a.returnBy).getTime() - new Date(b.returnBy).getTime();
        });
        setReturns(sortedReturns);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to load loan queues." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isTsg]);

  const filterLoans = (list: Loan[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (l) =>
        l.asset.tag.toLowerCase().includes(q) ||
        l.asset.name.toLowerCase().includes(q) ||
        (l.borrower && "name" in l.borrower && l.borrower.name.toLowerCase().includes(q))
    );
  };

  const filteredReleases = useMemo(() => filterLoans(releases), [releases, searchQuery]);
  const filteredReturns = useMemo(() => filterLoans(returns), [returns, searchQuery]);

  if (!isTsg) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
        <p className="text-xs text-muted-foreground">
          The {PAGE_TITLES.loans} console is restricted to TSG staff accounts.
        </p>
      </div>
    );
  }

  const handleReleaseSuccess = (loanId: number) => {
    setFeedback({
      type: "success",
      text: `Loan #${loanId} released successfully. Opening Accountability Form...`,
    });
    loadData();
    // Open the accountability form
    window.open(`/loans/${loanId}/accountability-form`, "_blank");
  };

  const handleReceiveSuccess = (message: string) => {
    setFeedback({ type: "success", text: message });
    loadData();
  };

  const headCls = "text-[10px] font-bold tracking-wider";
  const actionBtnCls = "h-7 text-[10px] font-bold px-2";

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-foreground mb-1">{PAGE_TITLES.loans}</h1>
          <p className="text-muted-foreground text-sm">
            Process equipment handovers, inspect returns, and manage active loans.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {feedback && (
        <div
          className={cn(
            "mb-4 p-3 rounded-lg border text-xs flex items-center justify-between",
            feedback.type === "success"
              ? "bg-primary/10 border-primary/20 text-primary"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <Button variant="link" size="sm" onClick={() => setFeedback(null)} className="h-auto p-0 ml-4 text-[11px] font-semibold text-current">
            Dismiss
          </Button>
        </div>
      )}

      {/* Tabs and Search */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "releases" | "returns" | "clearance")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="mb-4 h-auto gap-1 bg-muted/40">
            <TabsTrigger value="releases" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
              Releases
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {releases.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="returns" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-white">
              Returns
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {returns.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="relative mb-4 w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tag, equipment, or borrower..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>

        {/* Tab 1: Releases */}
        <TabsContent value="releases">
          <div className="flex items-center gap-3 mb-1">
            <Package size={18} className="text-primary" />
            <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Pending Releases</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Approved borrow requests awaiting equipment handover and TSG release inspection.
          </p>

          {filteredReleases.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              {searchQuery ? "No pending releases match your filter." : "No loans waiting for release."}
            </div>
          ) : (
            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className={headCls}>Asset Tag</TableHead>
                    <TableHead className={headCls}>Equipment</TableHead>
                    <TableHead className={headCls}>Borrower</TableHead>
                    <TableHead className={headCls}>Destination</TableHead>
                    <TableHead className={headCls}>Return By</TableHead>
                    <TableHead className={headCls}>Approved By</TableHead>
                    <TableHead className={headCls}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReleases.map((l) => {
                    const borrower = l.borrower && "name" in l.borrower ? l.borrower.name : "Researcher";
                    const approver = l.decidedBy && "name" in l.decidedBy ? l.decidedBy.name : "Lab Head";
                    const destination = `${l.destinationLab?.code ?? "Home"}${l.destinationRoom ? ` - ${l.destinationRoom}` : ""}`;

                    return (
                      <TableRow key={l.loanId} className="transition-colors hover:bg-muted/10">
                        <TableCell className="font-bold text-xs font-mono text-primary">{l.asset.tag}</TableCell>
                        <TableCell className="text-xs font-bold text-foreground">{l.asset.name}</TableCell>
                        <TableCell className="text-xs text-foreground">{borrower}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{destination}</TableCell>
                        <TableCell className="text-xs text-foreground font-medium">{l.returnBy}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{approver}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className={actionBtnCls}
                            onClick={() => {
                              setSelectedReleaseLoan(l);
                              setReleaseDialogOpen(true);
                            }}
                          >
                            Release
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Returns */}
        <TabsContent value="returns">
          <div className="flex items-center gap-3 mb-1">
            <RotateCcw size={18} className="text-primary" />
            <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Incoming Returns &amp; Active Loans</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Requested returns and walk-in returns for active loans out with researchers.
          </p>

          {filteredReturns.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
              {searchQuery ? "No returns match your filter." : "No active loans out for return."}
            </div>
          ) : (
            <Card className="overflow-hidden p-0 border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className={headCls}>Asset Tag</TableHead>
                    <TableHead className={headCls}>Equipment</TableHead>
                    <TableHead className={headCls}>Borrower</TableHead>
                    <TableHead className={headCls}>Return Due</TableHead>
                    <TableHead className={headCls}>Status</TableHead>
                    <TableHead className={headCls}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((l) => {
                    const borrower = l.borrower && "name" in l.borrower ? l.borrower.name : "Researcher";

                    return (
                      <TableRow key={l.loanId} className="transition-colors hover:bg-muted/10">
                        <TableCell className="font-bold text-xs font-mono text-primary">{l.asset.tag}</TableCell>
                        <TableCell className="text-xs font-bold text-foreground">{l.asset.name}</TableCell>
                        <TableCell className="text-xs text-foreground">{borrower}</TableCell>
                        <TableCell className="text-xs text-foreground font-medium">{l.returnBy}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[10px] font-semibold", loanStatusBadgeClass(l.status))}>
                              {l.statusLabel}
                            </Badge>
                            {l.status === "ON_LOAN" && (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                Walk-in
                              </Badge>
                            )}
                            {l.isOverdue && (
                              <Badge variant="destructive" className="text-[10px] font-bold">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            className={actionBtnCls}
                            onClick={() => {
                              setSelectedReturnLoan(l);
                              setReturnDialogOpen(true);
                            }}
                          >
                            Receive
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Release Dialog */}
      <LoanReleaseDialog
        loan={selectedReleaseLoan}
        open={releaseDialogOpen}
        onOpenChange={setReleaseDialogOpen}
        onSuccess={handleReleaseSuccess}
      />

      {/* Return Receive Dialog */}
      <LoanReceiveDialog
        loan={selectedReturnLoan}
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        onSuccess={handleReceiveSuccess}
      />
    </div>
  );
}
