/**
 * Labs section of the Reference Data page: each lab's short code, name, campus, and asset count, and the Add and Edit
 * dialogs. The short code is read-only once saved, because the lab's asset tags start with it.
 * Layer: feature component. Called by pages/staff/ReferenceDataPage.tsx.
 * Calls: api/reference.api.ts (listLabs, addLab, changeLab), useReferenceList.ts, and features/lookups/useLookups.ts
 * forgetFormLookups().
 * Used by: TSG and the Secretary.
 */
import { useState } from "react";
import { CAMPUSES, CAMPUS_LABELS, type Campus } from "@shared/constants/campuses";
import type { ReferenceLab } from "@shared/types/reference";
import * as referenceApi from "@web/api/reference.api";
import { forgetFormLookups } from "@web/features/lookups/useLookups";
import { useReferenceList } from "./useReferenceList";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/**
 * Adds a lab, or edits one when `lab` is given. The short code is typed only when adding. An edit sends only the
 * fields that changed. The server's sentence shows when it refuses.
 *
 * @param lab the lab to edit, or undefined to add one
 * @param onClose closes the dialog without a change
 * @param onSaved called with a plain sentence after the server accepted
 */
function LabDialog({ lab, onClose, onSaved }: {
  lab?: ReferenceLab;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [shortCode, setShortCode] = useState(lab?.shortCode ?? "");
  const [name, setName] = useState(lab?.name ?? "");
  const [campus, setCampus] = useState<Campus>(lab?.campus ?? "MANILA");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      let data;
      if (lab) {
        const changes: { name?: string; campus?: Campus } = {};
        if (name.trim() !== lab.name) changes.name = name;
        if (campus !== lab.campus) changes.campus = campus;
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        data = await referenceApi.changeLab(lab.centerId, changes);
      } else {
        data = await referenceApi.addLab({ name, shortCode: shortCode.trim(), campus });
      }
      if (!data.success) {
        setError(data.error ?? "Could not save the lab. Try again.");
        return;
      }
      onSaved(lab ? `${data.lab.shortCode} saved.` : `${data.lab.shortCode} added. Its first asset tag is ${data.lab.shortCode}-0001.`);
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
          <DialogTitle>{lab ? "Edit lab" : "Add lab"}</DialogTitle>
          <DialogDescription>
            The lab's asset tags start with its short code, so the short code cannot change after the lab is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lab-code" className="text-xs font-bold">Short code</Label>
            <Input
              id="lab-code"
              value={shortCode}
              maxLength={10}
              onChange={e => setShortCode(e.target.value)}
              readOnly={Boolean(lab)}
              disabled={saving || Boolean(lab)}
              className="font-mono"
            />
            {!lab && <p className="text-[11px] text-muted-foreground">2 to 10 letters and digits, for example CITe4D.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-name" className="text-xs font-bold">Name</Label>
            <Input id="lab-name" value={name} maxLength={255} onChange={e => setName(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-campus" className="text-xs font-bold">Campus</Label>
            <Select value={campus} onValueChange={value => setCampus(value as Campus)} disabled={saving}>
              <SelectTrigger id="lab-campus" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPUSES.map(value => (
                  <SelectItem key={value} value={value} className="text-xs">{CAMPUS_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || name.trim() === "" || shortCode.trim() === ""}>
            {saving ? "Saving..." : lab ? "Save" : "Add lab"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The labs table with its Add and Edit buttons. After a save the list is read again and the form option lists are
 * forgotten, so Register Asset offers the change without a reload.
 *
 * @param onNotice shows a plain sentence on the page after a save
 */
export function LabsSection({ onNotice }: { onNotice: (message: string) => void }) {
  const { rows, loading, error, reload } = useReferenceList<ReferenceLab>(referenceApi.listLabs, "labs");
  const [editing, setEditing] = useState<ReferenceLab | "new" | null>(null);

  const saved = (message: string) => {
    setEditing(null);
    forgetFormLookups();
    onNotice(message);
    reload();
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>Add lab</Button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Short code", "Name", "Campus", "Assets", "Actions"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                  {loading ? "Loading labs..." : "No labs yet."}
                </TableCell>
              </TableRow>
            ) : rows.map(lab => (
              <TableRow key={lab.centerId}>
                <TableCell className="text-xs font-mono font-semibold">{lab.shortCode}</TableCell>
                <TableCell className="text-xs">{lab.name}</TableCell>
                <TableCell className="text-xs">{lab.campusLabel}</TableCell>
                <TableCell className="text-xs">{lab.assetCount}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(lab)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <LabDialog
          key={editing === "new" ? "new" : editing.centerId}
          lab={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
