/**
 * IT Admin Users: finds any account after sign-up, and changes its role and labs, deactivates, reactivates, or
 * anonymizes it; and, on the Labs tab, sets each lab's Head.
 * Layer: page. Called by app/routes.tsx at /it-admin/users.
 * Calls: api/users.api.ts (the list and the one-click steps; api/client.ts for the ApiResult type),
 * features/lookups/useLookups.ts (the labs), features/users/ChangeRoleDialog.tsx, ChangeLabsDialog.tsx,
 * AnonymizeUserDialog.tsx and LabsTab.tsx, state/session.tsx (whose account is the IT Admin's own).
 * Used by: the IT Admin.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import { USER_TYPE_LABELS } from "@shared/constants/signUp";
import { DATABASE_ROLE_LABELS } from "@shared/enums/role";
import { ACCOUNT_STATUS_LABELS, type AccountStatus } from "@shared/constants/accountStatuses";
import type { User } from "@shared/types/users";
import * as usersApi from "@web/api/users.api";
import type { ApiResult } from "@web/api/client";
import { useSession } from "@web/state/session";
import { useFormLookups } from "@web/features/lookups/useLookups";
import { AnonymizeUserDialog } from "@web/features/users/AnonymizeUserDialog";
import { ChangeLabsDialog } from "@web/features/users/ChangeLabsDialog";
import { ChangeRoleDialog } from "@web/features/users/ChangeRoleDialog";
import { LabsTab } from "@web/features/users/LabsTab";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@web/components/ui/tooltip";

/** The two parts of the page: the accounts, and the labs with their Heads. */
type Section = "USERS" | "LABS";

/** The tabs of the accounts: every account the list sends (all but Pending), or one status. */
type FilterTab = "ALL" | Extract<AccountStatus, "ACTIVE" | "INACTIVE" | "REJECTED">;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All Users" },
  { key: "ACTIVE", label: ACCOUNT_STATUS_LABELS.ACTIVE },
  { key: "INACTIVE", label: ACCOUNT_STATUS_LABELS.INACTIVE },
  { key: "REJECTED", label: ACCOUNT_STATUS_LABELS.REJECTED },
];

/** The sentence a Head's blocked button gives. The server answers it too (409). */
const HEAD_FIRST_MESSAGE = "Change the lab's Head first.";

/** How long the search waits after the last key before it asks the server. */
const SEARCH_DELAY_MS = 300;

/** The longest search the server takes. */
const SEARCH_MAX_LENGTH = 100;

/** The page's message: what a step did, or the server's sentence when it refused. */
interface Notice {
  kind: "success" | "error";
  text: string;
}

/** A button the server would refuse for a lab's Head, shown greyed with the reason. */
function HeadBlockedButton({ label }: { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block" tabIndex={0}>
          <Button size="sm" variant="outline" disabled className="h-7 text-xs opacity-50 cursor-not-allowed" title={HEAD_FIRST_MESSAGE}>
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{HEAD_FIRST_MESSAGE}</TooltipContent>
    </Tooltip>
  );
}

const statusBadgeVariant = (status: AccountStatus) => {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "INACTIVE":
      return "secondary";
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
};

/**
 * Lists the accounts for the IT Admin, from the server, with their role, labs, Head status and account status. The tab
 * picks the status and the search is sent as `q`. A row shows only the buttons the server would accept: nothing on the
 * IT Admin's own account or on an anonymized one, and a lab's Head cannot be deactivated or given another role until
 * the lab has another Head. The server has the last word: when it refuses, its sentence shows in the notice. The list
 * reloads from the server after every step. Takes no props.
 */
export function UsersPage() {
  const { currentUser } = useSession();
  const { lookups, failed: lookupsFailed } = useFormLookups();
  const [section, setSection] = useState<Section>("USERS");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [changingRole, setChangingRole] = useState<User | null>(null);
  const [changingLabs, setChangingLabs] = useState<User | null>(null);
  const [anonymizing, setAnonymizing] = useState<User | null>(null);
  // Counts the loads, so a slow answer to an older tab or search never replaces a newer one.
  const loadCount = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const thisLoad = ++loadCount.current;
    setLoading(true);
    try {
      const data = await usersApi.listUsers({ status: tab === "ALL" ? undefined : tab, q: query || undefined });
      if (thisLoad !== loadCount.current) return;
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        setLoadError(null);
      } else {
        setLoadError(data.error || "Could not load the users. Try again.");
      }
    } catch {
      if (thisLoad !== loadCount.current) return;
      setLoadError("Can't reach the server right now. Try again in a moment.");
    } finally {
      if (thisLoad === loadCount.current) setLoading(false);
    }
  }, [tab, query]);

  // Also when the accounts come back into view, so a Head set on the Labs tab shows on its account.
  useEffect(() => {
    if (section === "USERS") load();
  }, [section, load]);

  /** A dialog's step went through: say so, close the dialogs, and read the list again. */
  const changed = (message: string) => {
    setNotice({ kind: "success", text: message });
    setChangingRole(null);
    setChangingLabs(null);
    setAnonymizing(null);
    load();
  };

  /** Runs a one-click step on a row. Success or refusal, the list is read again so the row shows what the server holds. */
  const runStep = async (user: User, step: (userId: number) => Promise<ApiResult>, done: string) => {
    setBusyUserId(user.userId);
    setNotice(null);
    try {
      const data = await step(user.userId);
      setNotice(data.success ? { kind: "success", text: done } : { kind: "error", text: data.error ?? "That did not work. Try again." });
    } catch {
      setNotice({ kind: "error", text: "Can't reach the server right now. Try again in a moment." });
    } finally {
      setBusyUserId(null);
    }
    await load();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">{PAGE_TITLES.administration}</h1>
        <p className="text-muted-foreground text-sm">
          {section === "USERS"
            ? "Users: view and manage active, inactive, and rejected accounts."
            : "Labs: see each lab's Head, and change who heads it."}
        </p>
      </div>

      <div className="mb-4 flex gap-2 border-b border-border pb-3">
        <Button size="sm" variant={section === "USERS" ? "default" : "outline"} onClick={() => setSection("USERS")}>Users</Button>
        <Button size="sm" variant={section === "LABS" ? "default" : "outline"} onClick={() => setSection("LABS")}>Labs</Button>
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            "mb-4 flex items-center justify-between rounded-md border px-4 py-2 text-xs font-medium " +
            (notice.kind === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-primary/30 bg-primary/10 text-primary")
          }
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold ml-4 cursor-pointer hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {section === "USERS" && loadError && <p role="alert" className="mb-3 text-sm text-destructive">{loadError}</p>}
      {lookupsFailed && <p role="alert" className="mb-3 text-sm text-destructive">Could not load the labs. Reload the page.</p>}

      {section === "LABS" && (
        lookups ? (
          <LabsTab labs={lookups.labs} onChanged={(message) => setNotice({ kind: "success", text: message })} />
        ) : (
          !lookupsFailed && <p className="text-muted-foreground text-sm">Loading labs...</p>
        )
      )}

      {section === "USERS" && (
        <>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {TABS.map(({ key, label }) => (
                <Button key={key} size="sm" variant={tab === key ? "default" : "outline"} onClick={() => setTab(key)}>
                  {label}
                </Button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Filter by name, email, or ID..."
              aria-label="Filter by name, email, or ID"
              value={searchInput}
              maxLength={SEARCH_MAX_LENGTH}
              onChange={(e) => setSearchInput(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-full sm:w-64"
            />
          </div>

          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {["Name", "Email", "ID Number", "Type", "Role", "Labs / Head", "Status", "Actions"].map((h) => (
                    <TableHead key={h} className="text-[10px] font-bold tracking-wider">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                      {loading ? "Loading users..." : "No users found matching the filter criteria."}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const roleDisplay = user.role ? DATABASE_ROLE_LABELS[user.role] : user.roleLabel ?? "None";
                    const isOwn = user.userId === currentUser?.userId;
                    const isAnonymized = user.anonymizedAt !== null;
                    const isHead = user.headOf !== null;
                    const isManaged = user.accountStatus === "ACTIVE" || user.accountStatus === "INACTIVE";
                    const busy = busyUserId === user.userId;

                    return (
                      <TableRow key={user.userId}>
                        <TableCell className="text-xs font-semibold">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell className="text-xs">{user.email}</TableCell>
                        <TableCell className="text-xs font-mono">{user.idNumber ?? "None"}</TableCell>
                        <TableCell className="text-xs">{USER_TYPE_LABELS[user.userType]}</TableCell>
                        <TableCell className="text-xs font-medium">{roleDisplay}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            {user.labs.length === 0 && <span className="text-muted-foreground text-[11px]">None</span>}
                            {user.labs.map((lab) => (
                              <Badge key={lab.centerId} variant="outline" className="text-[10px]">
                                {lab.code}
                              </Badge>
                            ))}
                            {user.headOf && (
                              <Badge variant="secondary" className="text-[10px] font-semibold">
                                Head: {user.headOf.code}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={statusBadgeVariant(user.accountStatus)} className="text-[10px]">
                            {ACCOUNT_STATUS_LABELS[user.accountStatus] ?? user.accountStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isOwn && <span className="text-[11px] text-muted-foreground">Your account</span>}
                            {!isOwn && isAnonymized && <span className="text-[11px] text-muted-foreground">Anonymized</span>}

                            {!isOwn && !isAnonymized && isManaged && (
                              <>
                                {isHead ? (
                                  <HeadBlockedButton label="Change role" />
                                ) : (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setChangingRole(user)}>
                                    Change role
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !lookups} onClick={() => setChangingLabs(user)}>
                                  Change labs
                                </Button>
                              </>
                            )}

                            {!isOwn && user.accountStatus === "ACTIVE" && (
                              isHead ? (
                                <HeadBlockedButton label="Deactivate" />
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                                  disabled={busy}
                                  onClick={() => runStep(user, usersApi.deactivateUser, `${user.firstName} ${user.lastName} deactivated.`)}
                                >
                                  Deactivate
                                </Button>
                              )
                            )}

                            {user.accountStatus === "INACTIVE" && !isAnonymized && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                                disabled={busy}
                                onClick={() => runStep(user, usersApi.reactivateUser, `${user.firstName} ${user.lastName} reactivated.`)}
                              >
                                Reactivate
                              </Button>
                            )}

                            {!isOwn && !isAnonymized && (user.accountStatus === "INACTIVE" || user.accountStatus === "REJECTED") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                disabled={busy}
                                onClick={() => setAnonymizing(user)}
                              >
                                Anonymize
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {changingRole && (
        <ChangeRoleDialog key={changingRole.userId} user={changingRole} onClose={() => setChangingRole(null)} onChanged={changed} />
      )}
      {changingLabs && lookups && (
        <ChangeLabsDialog key={changingLabs.userId} user={changingLabs} labs={lookups.labs} onClose={() => setChangingLabs(null)} onChanged={changed} />
      )}
      {anonymizing && (
        <AnonymizeUserDialog key={anonymizing.userId} user={anonymizing} onClose={() => setAnonymizing(null)} onAnonymized={changed} />
      )}
    </div>
  );
}
