/**
 * Staff Pending Returns: custodian return requests waiting to be checked and finalized.
 * Layer: page. Called by app/routes.tsx at /staff/returns.
 * Calls: state/browserOnly.tsx (the requests), state/serverData.tsx (the asset list), features/assets/useStaffAssets.ts,
 * features/returns/openReturnRequests.ts, features/returns/ReturnForm.tsx.
 * Used by: Staff return finalization.
 */
import { useState } from "react";
import { useBrowserOnly, type ReturnRequest } from "@web/state/browserOnly";
import { useServerData } from "@web/state/serverData";
import { openReturnRequests } from "@web/features/returns/openReturnRequests";
import { useStaffAssets } from "@web/features/assets/useStaffAssets";
import { ReturnForm } from "@web/features/returns/ReturnForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/**
 * Lists pending requests and opens ReturnForm to finalize one, which saves the return to the
 * database. Takes no props.
 */
// TODO(H-02): the requests live in this browser only, so Staff on another machine never see them. Phase 3.
export function ReturnsPage() {
  const { returns } = useBrowserOnly();
  const { assets } = useServerData();
  const { displayedAssets } = useStaffAssets();
  // The row clicked: its asset for the form, and its request, so that request is the one finalized.
  const [selected, setSelected] = useState<{ asset: any; request: ReturnRequest } | null>(null);

  // A request whose asset is no longer out (returned on another computer, say) is not listed.
  const pendingReturns = openReturnRequests(returns, assets);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">Pending Returns</h1>
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
                          setSelected({
                            request: req,
                            asset: matchingAsset ?? {
                              id: req.assetId,
                              name: req.assetName,
                              custodian: req.custodian,
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

      {/* Dialog for Finalizing Returns */}
      <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Evaluate &amp; Finalize Return</DialogTitle>
          </DialogHeader>
          {selected && (
            <ReturnForm
              asset={selected.asset}
              request={selected.request}
              onBack={() => setSelected(null)}
              onClose={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
