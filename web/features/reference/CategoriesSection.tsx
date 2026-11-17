/**
 * Categories section of the Reference Data page: the asset categories with their code, useful life, asset count, and
 * whether they are active, and the Add and Edit dialogs.
 * Layer: feature component. Called by pages/staff/ReferenceDataPage.tsx.
 * Calls: api/reference.api.ts (listCategories, addCategory, changeCategory), useReferenceList.ts, and
 * features/lookups/useLookups.ts forgetFormLookups().
 * Used by: TSG and the Secretary.
 */
import { useState } from "react";
import type { ReferenceCategory } from "@shared/types/reference";
import * as referenceApi from "@web/api/reference.api";
import { forgetFormLookups } from "@web/features/lookups/useLookups";
import { useReferenceList } from "./useReferenceList";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Switch } from "@web/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/** The words under the useful life field, in the Add and the Edit dialog. */
const USEFUL_LIFE_HINT = "Changing this changes the present value of every asset in this category.";

/**
 * Adds a category, or edits one when `category` is given. The code is made by the server from the label and never
 * changes. An edit sends only the fields that changed. The server's sentence shows when it refuses.
 *
 * @param category the category to edit, or undefined to add one
 * @param onClose closes the dialog without a change
 * @param onSaved called with a plain sentence after the server accepted
 */
function CategoryDialog({ category, onClose, onSaved }: {
  category?: ReferenceCategory;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [label, setLabel] = useState(category?.label ?? "");
  const [usefulLife, setUsefulLife] = useState(String(category?.usefulLifeYears ?? 5));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const years = Number(usefulLife);
    setSaving(true);
    setError(null);
    try {
      let data;
      if (category) {
        const changes: { label?: string; usefulLifeYears?: number; isActive?: boolean } = {};
        if (label.trim() !== category.label) changes.label = label;
        if (years !== category.usefulLifeYears) changes.usefulLifeYears = years;
        if (isActive !== category.isActive) changes.isActive = isActive;
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        data = await referenceApi.changeCategory(category.code, changes);
      } else {
        data = await referenceApi.addCategory({ label, usefulLifeYears: years });
      }
      if (!data.success) {
        setError(data.error ?? "Could not save the category. Try again.");
        return;
      }
      onSaved(category ? `${data.category.label} saved.` : `${data.category.label} added, with the code ${data.category.code}.`);
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
          <DialogTitle>{category ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            {category
              ? `The code ${category.code} stays the same: the assets keep it.`
              : "The code is made from the label, in capital letters, and cannot change later."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="category-label" className="text-xs font-bold">Label</Label>
            <Input id="category-label" value={label} maxLength={100} onChange={e => setLabel(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-life" className="text-xs font-bold">Useful life (years)</Label>
            <Input id="category-life" type="number" min={1} max={50} step={1} value={usefulLife} onChange={e => setUsefulLife(e.target.value)} disabled={saving} />
            <p className="text-[11px] text-muted-foreground">{USEFUL_LIFE_HINT}</p>
          </div>
          {category && (
            <div className="flex items-center gap-2">
              <Switch id="category-active" checked={isActive} onCheckedChange={setIsActive} disabled={saving} />
              <Label htmlFor="category-active" className="text-xs font-bold">Active</Label>
              <span className="text-[11px] text-muted-foreground">An inactive category is not offered for a new asset. Assets that have it keep it.</span>
            </div>
          )}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || label.trim() === ""}>{saving ? "Saving..." : category ? "Save" : "Add category"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The categories table with its Add and Edit buttons. After a save the list is read again and the form option lists
 * are forgotten, so Register Asset offers the change without a reload.
 *
 * @param onNotice shows a plain sentence on the page after a save
 */
export function CategoriesSection({ onNotice }: { onNotice: (message: string) => void }) {
  const { rows, loading, error, reload } = useReferenceList<ReferenceCategory>(referenceApi.listCategories, "categories");
  const [editing, setEditing] = useState<ReferenceCategory | "new" | null>(null);

  const saved = (message: string) => {
    setEditing(null);
    forgetFormLookups();
    onNotice(message);
    reload();
  };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>Add category</Button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Label", "Code", "Useful life", "Assets", "Active", "Actions"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                  {loading ? "Loading categories..." : "No categories yet."}
                </TableCell>
              </TableRow>
            ) : rows.map(c => (
              <TableRow key={c.code}>
                <TableCell className="text-xs font-semibold">{c.label}</TableCell>
                <TableCell className="text-xs font-mono">{c.code}</TableCell>
                <TableCell className="text-xs">{c.usefulLifeYears} {c.usefulLifeYears === 1 ? "year" : "years"}</TableCell>
                <TableCell className="text-xs">{c.assetCount}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant={c.isActive ? "default" : "secondary"} className="text-[10px]">{c.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(c)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <CategoryDialog
          key={editing === "new" ? "new" : editing.code}
          category={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
