/**
 * Staff Pending Returns: loans waiting to be received by TSG. Return Requested loans come first, then loans still On Loan
 * that can be received as a walk-in.
 * Layer: page. Called by app/routes.tsx at /staff/returns.
 * Calls: features/returns/usePendingReturns.ts (the loans), features/assets/useStaffAssets.ts, features/returns/ReturnForm.tsx.
 * Used by: Staff return finalization.
 */
import { useState } from "react";
import type { Loan } from "@shared/types/loans";
import { usePendingReturns } from "@web/features/returns/usePendingReturns";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { ReturnForm } from "@web/features/returns/ReturnForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Badge } from "@web/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/** The borrower's name as TSG see it. */
const borrowerName = (loan: Loan) => ("hidden" in loan.borrower ? "Not shown" : loan.borrower.name);

/**
 * Lists the loans TSG can receive and opens ReturnForm to receive one, which saves the return to the database. Only
 * TSG load the list; any other Staff account sees a short notice. Takes no props.
 */
export function ReturnsPage() {
  const { isTsg, requested, walkIns, loading, error } = usePendingReturns();
  const { displayedAssets } = useStaffAssets();
  // The row clicked: its asset for the form, and its loan, so that loan is the one received.
  const [selected, setSelected] = useState<{ asset: any; loan: Loan } | null>(null);

  const rows = [...requested, ...walkIns];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Pending Returns</h1>
        <p className="text-muted-foreground text-sm">Verify physical equipment presence, condition check, and close borrow records.</p>
      </div>

      {!isTsg ? (
        <Card className="p-6 text-sm text-muted-foreground">Only TSG staff receive returns.</Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {error && <div className="text-xs text-red-600 bg-red-50 border-b border-red-200 px-4 py-2">{error}</div>}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {["Asset ID", "Asset Name", "Custodian", "Return By", "Custodian Comments", "Action"].map(h => (
                  <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {loading ? "Loading pending returns…" : "No pending return requests in queue."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(loan => {
                  const matchingAsset = displayedAssets.find(a => a.id === loan.asset.tag);
                  const asked = loan.status === "RETURN_REQUESTED";
                  return (
                    <TableRow key={loan.loanId}>
                      <TableCell className="font-bold text-primary text-xs">{loan.asset.tag}</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{loan.asset.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{borrowerName(loan)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{loan.returnBy}</TableCell>
                      <TableCell className="text-xs text-muted-foreground italic max-w-[200px] truncate" title={loan.remarks ?? undefined}>
                        {asked ? `"${loan.remarks || "None"}"` : <Badge variant="outline" className="text-[10px] not-italic">Not asked yet</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => {
                            setSelected({
                              loan,
                              asset: matchingAsset ?? {
                                id: loan.asset.tag,
                                name: loan.asset.name,
                                custodian: borrowerName(loan),
                                status: "Pending Return",
                                // Used only when the asset is not in the list (for example, deleted since the request).
                                category: "Computing Array"
                              },
                            });
                          }}
                        >
                          Evaluate &amp; Finalize
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog for Finalizing Returns */}
      <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Evaluate &amp; Finalize Return</DialogTitle>
          </DialogHeader>
          {selected && (
            <ReturnForm
              asset={selected.asset}
              loan={selected.loan}
              onBack={() => setSelected(null)}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
