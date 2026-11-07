/**
 * Labs tab: every lab with its Head (or "No Head"), and a Change Head button on each.
 * Layer: feature component. Called by pages/it-admin/UsersPage.tsx.
 * Calls: api/users.api.ts listUsers(), features/users/ChangeLabHeadDialog.tsx.
 * Used by: the IT Admin's Users page.
 */
import { useCallback, useEffect, useState } from "react";
import type { LookupLab } from "@shared/types/lookups";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import { ChangeLabHeadDialog } from "@web/features/users/ChangeLabHeadDialog";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/**
 * Lists the labs from the lookups with their Heads. The Heads and the members a Head can be picked from both come from
 * one list, the Active Researchers (a Head is always one), read from the server when the tab opens and after each
 * change. The lookups' own Head id is not used: that list is loaded once per page load and would go stale.
 *
 * @param labs the labs from the lookups
 * @param onChanged called with a plain sentence about a Head change after the server accepted
 */
export function LabsTab({ labs, onChanged }: {
  labs: LookupLab[];
  onChanged: (message: string) => void;
}) {
  const [researchers, setResearchers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState<LookupLab | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.listUsers({ status: "ACTIVE", role: "RESEARCHER" });
      if (data.success && Array.isArray(data.users)) {
        setResearchers(data.users);
        setError(null);
      } else {
        setError(data.error || "Could not load the Heads. Try again.");
      }
    } catch {
      setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const headOf = (centerId: number) => researchers.find(user => user.headOf?.centerId === centerId) ?? null;
  const membersOf = (centerId: number) => researchers.filter(user => user.labs.some(lab => lab.centerId === centerId));

  const changed = (message: string) => {
    setChanging(null);
    load();
    onChanged(message);
  };

  return (
    <div>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Lab", "Name", "Campus", "Head", "Action"].map(h => (
                <TableHead key={h} className="text-[10px] font-bold tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {labs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">No labs found.</TableCell>
              </TableRow>
            ) : (
              labs.map(lab => {
                const head = headOf(lab.centerId);
                return (
                  <TableRow key={lab.centerId}>
                    <TableCell className="text-xs font-semibold">{lab.code}</TableCell>
                    <TableCell className="text-xs">{lab.name}</TableCell>
                    <TableCell className="text-xs">{lab.campusLabel}</TableCell>
                    <TableCell className="text-xs">
                      {loading && !head ? (
                        <span className="text-muted-foreground">Loading...</span>
                      ) : error && !head ? (
                        <span className="text-muted-foreground">Unknown</span>
                      ) : head ? (
                        `${head.firstName} ${head.lastName}`
                      ) : (
                        <span className="text-muted-foreground">No Head</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading || error !== null} onClick={() => setChanging(lab)}>
                        Change Head
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {changing && (
        <ChangeLabHeadDialog
          key={changing.centerId}
          lab={changing}
          members={membersOf(changing.centerId)}
          currentHeadId={headOf(changing.centerId)?.userId ?? null}
          onClose={() => setChanging(null)}
          onChanged={changed}
        />
      )}
    </div>
  );
}
