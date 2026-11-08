/**
 * The Clearance tab of the Asset Loans page: the people who have borrowed, with a button to prepare each one's clearance record.
 * Layer: feature component. Called by pages/staff/LoansPage.tsx. Calls components/ui, clearanceRows.ts.
 * Used by: TSG, to open the printable Equipment Return and Clearance Record (/staff/clearance/:userId) in a new tab.
 */
import { ClipboardCheck } from "lucide-react";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import type { ClearanceRow } from "./clearanceRows";

/**
 * Lists the borrowers, one row each. The record page works out cleared or not cleared itself, from the server.
 *
 * @param rows the borrowers to show, already filtered by the search box
 * @param searching true when the search box has text, so an empty list reads as "no match"
 */
export function ClearanceTab({ rows, searching }: { rows: ClearanceRow[]; searching: boolean }) {
  const headCls = "text-[10px] font-bold tracking-wider";

  return (
    <>
      <div className="flex items-center gap-3 mb-1">
        <ClipboardCheck size={18} className="text-primary" />
        <h3 className="text-foreground font-bold text-sm tracking-wide uppercase">Clearance Records</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        People who have borrowed equipment. Prepare a borrower's Equipment Return and Clearance Record to print it.
      </p>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 border border-dashed border-border rounded-xl">
          {searching ? "No borrowers match your filter." : "No one has borrowed equipment yet."}
        </div>
      ) : (
        <Card className="overflow-hidden p-0 border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className={headCls}>Borrower</TableHead>
                <TableHead className={headCls}>Open Loans</TableHead>
                <TableHead className={headCls}>Loans on Record</TableHead>
                <TableHead className={headCls}>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="text-xs font-bold text-foreground">{r.name}</TableCell>
                  <TableCell className="text-xs font-mono text-foreground">{r.openLoans}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{r.loansOnRecord}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      className="h-7 text-[10px] font-bold px-2"
                      onClick={() => window.open(`/staff/clearance/${r.userId}`, "_blank")}
                    >
                      Prepare Clearance Record
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
