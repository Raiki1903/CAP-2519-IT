/**
 * Asset Loaning and Return page for TSG staff.
 * Layer: page. Called by app/routes.tsx at /staff/loans.
 * Calls: api/loans.api.ts listLoansByStatus(), LoanReleaseDialog, LoanReceiveDialog.
 * Used by: TSG Staff.
 */
import { useEffect, useState, useMemo } from "react";
import { Search, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import { useSession } from "@web/state/session";
import { listLoansByStatus } from "@web/api/loans.api";
import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Badge } from "@web/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@web/components/ui/card";
import { LoanReleaseDialog } from "@web/features/loans/LoanReleaseDialog";
import { LoanReceiveDialog } from "@web/features/loans/LoanReceiveDialog";
import type { Loan } from "@web/features/loans/loanTypes";

/**
 * Main Asset Loaning and Return management screen with Releases and Returns tabs.
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

      if (releasesRes.success && Array.isArray((releasesRes as any)?.loans)) {
        setReleases((releasesRes as any).loans);
      }

      if (returnsRes.success && Array.isArray((returnsRes as any)?.loans)) {
        // Return Requested first, then On Loan
        const sortedReturns = [...((returnsRes as any).loans as Loan[])].sort((a, b) => {
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
        (l.asset.serial && l.asset.serial.toLowerCase().includes(q)) ||
        (l.borrower && "name" in l.borrower && l.borrower.name.toLowerCase().includes(q))
    );
  };

  const filteredReleases = useMemo(() => filterLoans(releases), [releases, searchQuery]);
  const filteredReturns = useMemo(() => filterLoans(returns), [returns, searchQuery]);

  if (!isTsg) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
        <p className="text-xs text-muted-foreground">
          The Asset Loaning and Return console is restricted to TSG staff accounts.
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            {PAGE_TITLES.loans}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Process equipment handovers, inspect returns, and manage active loans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] underline font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs and Search */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "releases" | "returns" | "clearance")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="releases" className="text-xs font-bold gap-2">
              Releases
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                {releases.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="returns" className="text-xs font-bold gap-2">
              Returns
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                {returns.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tag, serial, or borrower..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>
        </div>

        {/* Tab 1: Releases */}
        <TabsContent value="releases" className="mt-2 space-y-4">
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold text-foreground">
                Pending Releases
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Approved borrow requests awaiting equipment handover and TSG release inspection.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredReleases.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {searchQuery ? "No pending releases match your filter." : "No loans waiting for release."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-y border-border/60 bg-muted/40 font-semibold text-muted-foreground">
                        <th className="px-4 py-2.5">Asset Tag</th>
                        <th className="px-4 py-2.5">Equipment</th>
                        <th className="px-4 py-2.5">Borrower</th>
                        <th className="px-4 py-2.5">Destination</th>
                        <th className="px-4 py-2.5">Return By</th>
                        <th className="px-4 py-2.5">Approved By</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredReleases.map((l) => {
                        const borrower = l.borrower && "name" in l.borrower ? l.borrower.name : "Researcher";
                        const approver = l.decidedBy && "name" in l.decidedBy ? l.decidedBy.name : "Lab Head";
                        const destination = `${l.destinationLab?.code ?? "Home"}${l.destinationRoom ? ` - ${l.destinationRoom}` : ""}`;

                        return (
                          <tr key={l.loanId} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-primary">
                              {l.asset.tag}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {l.asset.name}
                            </td>
                            <td className="px-4 py-3 text-foreground">{borrower}</td>
                            <td className="px-4 py-3 text-muted-foreground">{destination}</td>
                            <td className="px-4 py-3 text-foreground font-medium">{l.returnBy}</td>
                            <td className="px-4 py-3 text-muted-foreground">{approver}</td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedReleaseLoan(l);
                                  setReleaseDialogOpen(true);
                                }}
                                className="bg-[#005A36] text-white hover:bg-[#005A36]/90 text-xs font-bold h-8 px-3"
                              >
                                Release
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Returns */}
        <TabsContent value="returns" className="mt-2 space-y-4">
          <Card className="border border-border bg-card shadow-sm rounded-xl">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-bold text-foreground">
                Incoming Returns & Active Loans
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Requested returns and walk-in returns for active loans out with researchers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredReturns.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {searchQuery ? "No returns match your filter." : "No active loans out for return."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-y border-border/60 bg-muted/40 font-semibold text-muted-foreground">
                        <th className="px-4 py-2.5">Asset Tag</th>
                        <th className="px-4 py-2.5">Equipment</th>
                        <th className="px-4 py-2.5">Borrower</th>
                        <th className="px-4 py-2.5">Return Due</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredReturns.map((l) => {
                        const borrower = l.borrower && "name" in l.borrower ? l.borrower.name : "Researcher";
                        const isRequested = l.status === "RETURN_REQUESTED";

                        return (
                          <tr key={l.loanId} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-primary">
                              {l.asset.tag}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {l.asset.name}
                            </td>
                            <td className="px-4 py-3 text-foreground">{borrower}</td>
                            <td className="px-4 py-3 text-foreground font-medium">{l.returnBy}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isRequested ? (
                                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-semibold">
                                    Return requested
                                  </Badge>
                                ) : (
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
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedReturnLoan(l);
                                  setReturnDialogOpen(true);
                                }}
                                className="bg-[#005A36] text-white hover:bg-[#005A36]/90 text-xs font-bold h-8 px-3"
                              >
                                Receive
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
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
