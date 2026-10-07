import { useState } from "react";
import { useBrowserOnly } from "@web/state/browserOnly";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { ReturnForm } from "@web/features/returns/ReturnForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

export function ReturnsPage() {
  const { returns } = useBrowserOnly();
  const { displayedAssets } = useStaffAssets();
  const [selectedReturnAsset, setSelectedReturnAsset] = useState<any | null>(null);

  const pendingReturns = returns.filter(r => r.status === "Pending");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Pending Returns Ledger</h1>
        <p className="text-muted-foreground text-sm">Verify physical equipment presence, condition check, and close borrow records.</p>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Asset ID", "Asset Name", "Custodian", "Proposed Return Date", "Custodian Comments", "Action"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingReturns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No pending return requests in queue.
                </TableCell>
              </TableRow>
            ) : (
              pendingReturns.map(req => {
                const matchingAsset = displayedAssets.find(a => a.id === req.assetId);
                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-bold text-primary text-xs">{req.assetId}</TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">{req.assetName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{req.custodian}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{req.returnDate}</TableCell>
                    <TableCell className="text-xs text-muted-foreground italic max-w-[200px] truncate" title={req.comments}>
                      "{req.comments || "—"}"
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          if (matchingAsset) {
                            setSelectedReturnAsset(matchingAsset);
                          } else {
                            setSelectedReturnAsset({
                              id: req.assetId,
                              name: req.assetName,
                              custodian: req.custodian,
                              status: "Pending Return",
                              category: "Computing Array"
                            });
                          }
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

      {/* Dialog for Finalizing Returns */}
      <Dialog open={selectedReturnAsset !== null} onOpenChange={open => { if (!open) setSelectedReturnAsset(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Evaluate &amp; Finalize Return</DialogTitle>
          </DialogHeader>
          {selectedReturnAsset && (
            <ReturnForm
              asset={selectedReturnAsset}
              onBack={() => setSelectedReturnAsset(null)}
              onClose={() => setSelectedReturnAsset(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
