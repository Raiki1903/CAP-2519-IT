/**
 * IT Admin Users: lists accounts across active, inactive, and rejected statuses.
 * Layer: page. Called by app/routes.tsx at /it-admin/users.
 * Calls: shared/constants, shared/types, UI primitives, and mockUsers.ts.
 * Used by: the IT Admin.
 */
import { useState, useMemo } from "react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import { USER_TYPE_LABELS } from "@shared/constants/signUp";
import { DATABASE_ROLE_LABELS } from "@shared/enums/role";
import { ACCOUNT_STATUS_LABELS, type AccountStatus } from "@shared/constants/accountStatuses";
import type { User } from "@shared/types/users";
import { MOCK_USERS } from "./mockUsers";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@web/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@web/components/ui/tooltip";

type FilterTab = "ALL" | Extract<AccountStatus, "ACTIVE" | "INACTIVE" | "REJECTED">;

/**
 * Lists the accounts for the IT Admin, showing role, lab memberships, Lab Head status, and account status.
 * Enforces Contract 7.7 by disabling deactivation for accounts heading a lab, and Contract 4 by offering
 * irreversible anonymization with a confirmation dialog for inactive or rejected accounts.
 */
export function UsersPage() {
  const [userList, setUserList] = useState<User[]>(MOCK_USERS);
  const [statusFilter, setStatusFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [anonymizingUser, setAnonymizingUser] = useState<User | null>(null);

  const filteredUsers = useMemo(() => {
    return userList.filter((user) => {
      if (statusFilter !== "ALL" && user.accountStatus !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) {
        return true;
      }
      const q = searchQuery.toLowerCase();
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      const idNum = user.idNumber ? String(user.idNumber) : "";
      return fullName.includes(q) || email.includes(q) || idNum.includes(q);
    });
  }, [userList, statusFilter, searchQuery]);

  const handleDeactivate = (userId: number) => {
    setUserList((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, accountStatus: "INACTIVE" } : u))
    );
    const target = userList.find((u) => u.userId === userId);
    setNotice(`User ${target?.firstName} ${target?.lastName} deactivated.`);
  };

  const handleReactivate = (userId: number) => {
    setUserList((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, accountStatus: "ACTIVE" } : u))
    );
    const target = userList.find((u) => u.userId === userId);
    setNotice(`User ${target?.firstName} ${target?.lastName} reactivated.`);
  };

  const handleConfirmAnonymize = () => {
    if (!anonymizingUser) return;
    const targetId = anonymizingUser.userId;
    setUserList((prev) =>
      prev.map((u) =>
        u.userId === targetId
          ? {
              ...u,
              firstName: "Former",
              lastName: "researcher",
              email: `anonymized-${targetId}@invalid`,
              idNumber: null,
            }
          : u
      )
    );
    setNotice(`Account #${targetId} anonymized.`);
    setAnonymizingUser(null);
  };

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">{PAGE_TITLES.administration}</h1>
        <p className="text-muted-foreground text-sm">
          Users: view and manage active, inactive, and rejected accounts.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-4 flex items-center justify-between rounded-md bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800 border border-emerald-200"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "ACTIVE", "INACTIVE", "REJECTED"] as const).map((tab) => {
            const label =
              tab === "ALL"
                ? "All Users"
                : tab === "ACTIVE"
                ? "Active"
                : tab === "INACTIVE"
                ? "Inactive"
                : "Rejected";
            return (
              <Button
                key={tab}
                size="sm"
                variant={statusFilter === tab ? "default" : "outline"}
                onClick={() => setStatusFilter(tab)}
              >
                {label}
              </Button>
            );
          })}
        </div>

        <input
          type="text"
          placeholder="Filter by name, email, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-full sm:w-64"
        />
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {["Name", "Email", "ID Number", "Type", "Role", "Labs / Head", "Status", "Actions"].map(
                (h) => (
                  <TableHead key={h} className="text-[10px] font-bold tracking-wider">
                    {h}
                  </TableHead>
                )
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                  No users found matching the filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const roleDisplay = user.role
                  ? DATABASE_ROLE_LABELS[user.role]
                  : user.roleLabel ?? "None";
                const isHead = user.headOf !== null;
                const canAnonymize =
                  user.accountStatus === "INACTIVE" || user.accountStatus === "REJECTED";

                return (
                  <TableRow key={user.userId}>
                    <TableCell className="text-xs font-semibold">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell className="text-xs">{user.email}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {user.idNumber ?? "None"}
                    </TableCell>
                    <TableCell className="text-xs">{USER_TYPE_LABELS[user.userType]}</TableCell>
                    <TableCell className="text-xs font-medium">{roleDisplay}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        {user.labs.length === 0 && (
                          <span className="text-muted-foreground text-[11px]">None</span>
                        )}
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
                        {user.accountStatus === "ACTIVE" && (
                          isHead ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block" tabIndex={0}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled
                                    className="h-7 text-xs opacity-50 cursor-not-allowed"
                                    title="Change the lab's Head first."
                                  >
                                    Deactivate
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>Change the lab's Head first.</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                              onClick={() => handleDeactivate(user.userId)}
                            >
                              Deactivate
                            </Button>
                          )
                        )}

                        {user.accountStatus === "INACTIVE" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                            onClick={() => handleReactivate(user.userId)}
                          >
                            Reactivate
                          </Button>
                        )}

                        {canAnonymize && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setAnonymizingUser(user)}
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

      {anonymizingUser && (
        <Dialog open onOpenChange={(open) => { if (!open) setAnonymizingUser(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Anonymize Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to anonymize{" "}
                <span className="font-semibold text-foreground">
                  {anonymizingUser.firstName} {anonymizingUser.lastName}
                </span>{" "}
                ({anonymizingUser.email})?
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 text-xs text-muted-foreground">
              This action cannot be undone. In accordance with Contract 4, their name will be set to
              "Former researcher", their email to an invalid domain, and their ID number cleared to
              free it for future registration.
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnonymizingUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmAnonymize}
              >
                Confirm Anonymization
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
