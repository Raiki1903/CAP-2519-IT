/**
 * Funding sources section of the Reference Data page: each funding source with how many assets and projects name it,
 * and the Add and Rename dialogs.
 * Layer: feature component. Called by pages/staff/ReferenceDataPage.tsx.
 * Calls: api/reference.api.ts (listFundingSources, addFundingSource, renameFundingSource), useReferenceList.ts, and
 * features/lookups/useLookups.ts forgetFormLookups().
 * Used by: TSG and the Secretary.
 */
import { useState } from "react";
import type { ReferenceFundingSource } from "@shared/types/reference";
import * as referenceApi from "@web/api/reference.api";
import { forgetFormLookups } from "@web/features/lookups/useLookups";
import { useReferenceList } from "./useReferenceList";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/**
 * Adds a funding source, or renames one when `source` is given. The server's sentence shows when it refuses, for
 * example a name another funding source has in another letter case.
 *
 * @param source the funding source to rename, or undefined to add one
 * @param onClose closes the dialog without a change
 * @param onSaved called with a plain sentence after the server accepted
 */
function FundingSourceDialog({ source, onClose, onSaved }: {
  source?: ReferenceFundingSource;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(source?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (source && name.trim() === source.name) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = source
        ? await referenceApi.renameFundingSource(source.fundingSourceId, { name })
        : await referenceApi.addFundingSource({ name });
      if (!data.success) {
        setError(data.error ?? "Could not save the funding source. Try again.");
        return;
      }
      onSaved(source ? `${source.name} renamed to ${data.fundingSource.name}.` : `${data.fundingSource.name} added.`);
    } catch {
      setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{source ? "Rename funding source" : "Add funding source"}</DialogTitle>
          <DialogDescription>
            {source
              ? `The ${source.assetCount} assets and ${source.projectCount} projects that name it show the new name.`
              : "It is offered on Register Asset and Edit Asset as soon as it is saved."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="funding-name" className="text-xs font-bold">Name</Label>
          <Input id="funding-name" value={name} maxLength={100} onChange={e => setName(e.target.value)} disabled={saving} />
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || name.trim() === ""}>{saving ? "Saving..." : source ? "Rename" : "Add funding source"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The funding sources table with its Add and Rename buttons. After a save the list is read again and the form option
 * lists are forgotten, so Register Asset offers the change without a reload.
 *
 * @param onNotice shows a plain sentence on the page after a save
 */
export function FundingSourcesSection({ onNotice }: { onNotice: (message: string) => void }) {
  const { rows, loading, error, reload } = useReferenceList<ReferenceFundingSource>(referenceApi.listFundingSources, "fundingSources");
  const [editing, setEditing] = useState<ReferenceFundingSource | "new" | null>(null);

  const saved = (message: string) => {
    setEditing(null);
    forgetFormLookups();
    onNotice(message);
    reload();
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>Add funding source</Button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Name", "Assets", "Projects", "Actions"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                  {loading ? "Loading funding sources..." : "No funding sources yet."}
                </TableCell>
              </TableRow>
            ) : rows.map(source => (
              <TableRow key={source.fundingSourceId}>
                <TableCell className="text-xs font-semibold">{source.name}</TableCell>
                <TableCell className="text-xs">{source.assetCount}</TableCell>
                <TableCell className="text-xs">{source.projectCount}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(source)}>Rename</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <FundingSourceDialog
          key={editing === "new" ? "new" : editing.fundingSourceId}
          source={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
