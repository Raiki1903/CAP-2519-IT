/**
 * Lab multi-select: a list of checkboxes, one per lab, for choosing one or more labs.
 * Layer: feature component. Called by features/users/ApproveSignUpDialog.tsx and pages/auth/Register.tsx.
 * Calls: ui/checkbox.tsx, ui/label.tsx. No api calls: the labs come from GET /api/lookups through features/lookups/useLookups.ts.
 * Used by: sign-up, and the IT Admin's approval of a sign-up.
 */
import type { LookupLab } from "@shared/types/lookups";
import { Checkbox } from "@web/components/ui/checkbox";
import { Label } from "@web/components/ui/label";

/**
 * Shows every lab with a checkbox, grouped by nothing: the server's order (by code) is kept.
 *
 * @param labs the labs from the lookups
 * @param value the ids of the chosen labs
 * @param onChange called with the new list of chosen ids, in the order of `labs`
 * @param idPrefix makes each checkbox's id unique when two lists are on one page
 * @param disabled greys the list while a request is running
 */
export function LabMultiSelect({ labs, value, onChange, idPrefix, disabled }: {
  labs: LookupLab[];
  value: number[];
  onChange: (centerIds: number[]) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const toggle = (centerId: number, checked: boolean) => {
    const chosen = new Set(value);
    if (checked) chosen.add(centerId);
    else chosen.delete(centerId);
    onChange(labs.map(l => l.centerId).filter(id => chosen.has(id)));
  };

  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 space-y-1" role="group" aria-label="Labs">
      {labs.map(lab => {
        const id = `${idPrefix}-lab-${lab.centerId}`;
        return (
          <div key={lab.centerId} className="flex items-start gap-2 rounded px-1.5 py-1 hover:bg-slate-50">
            <Checkbox
              id={id}
              checked={value.includes(lab.centerId)}
              disabled={disabled}
              onCheckedChange={checked => toggle(lab.centerId, checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor={id} className="text-xs font-normal leading-snug cursor-pointer">
              <span className="font-bold">{lab.code}</span> {lab.name} ({lab.campusLabel})
            </Label>
          </div>
        );
      })}
    </div>
  );
}
