/**
 * IT Admin Users: lists active and inactive accounts with actions to deactivate, reactivate, or anonymize.
 * Layer: page. Called by app/routes.tsx at /it-admin/users.
 * Calls: shared/constants, shared/types, UI primitives. Uses hardcoded mock data until GET /api/users supports active accounts.
 * Used by: the IT Admin.
 */
import { useState, useMemo } from "react";
import { PAGE_TITLES } from "@shared/constants/pageTitles";
import { USER_TYPE_LABELS, type UserType } from "@shared/constants/signUp";
import type { DatabaseRole } from "@shared/enums/role";
import type { AccountStatus } from "@shared/constants/accountStatuses";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@web/components/ui/table";

/** One lab assigned to an account, identified by its ID and short code. */
export interface UserLab {
  centerId: number;
  code: string;
}

/** An account as managed on the IT Admin users screen. */
export interface ManagedUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number | null;
  userType: UserType;
  role: DatabaseRole;
  roleLabel: string;
  accountStatus: Extract<AccountStatus, "ACTIVE" | "INACTIVE">;
  labs: UserLab[];
  headOf: UserLab | null;
}

/** Mock initial user dataset representing active and inactive DLSU accounts. */
export const INITIAL_MOCK_USERS: ManagedUser[] = [
  {
    userId: 1,
    firstName: "System",
    lastName: "Admin",
    email: "itadmin@dlsu.edu.ph",
    idNumber: 12000001,
    userType: "FACULTY",
    role: "IT_ADMIN",
    roleLabel: "IT Admin",
    accountStatus: "ACTIVE",
    labs: [],
    headOf: null,
  },
  {
    userId: 2,
    firstName: "Teresa",
    lastName: "Santos",
    email: "teresa.santos@dlsu.edu.ph",
    idNumber: 11800002,
    userType: "FACULTY",
    role: "RESEARCHER",
    roleLabel: "Researcher",
    accountStatus: "ACTIVE",
    labs: [
      { centerId: 1, code: "AL" },
      { centerId: 2, code: "CV" },
    ],
    headOf: { centerId: 1, code: "AL" },
  },
  {
    userId: 3,
    firstName: "Mark",
    lastName: "Reyes",
    email: "mark.reyes@dlsu.edu.ph",
    idNumber: 11900003,
    userType: "STAFF",
    role: "TSG_STAFF",
    roleLabel: "TSG Staff",
    accountStatus: "ACTIVE",
    labs: [],
    headOf: null,
  },
  {
    userId: 4,
    firstName: "Elena",
    lastName: "Cruz",
    email: "elena.cruz@dlsu.edu.ph",
    idNumber: 11500004,
    userType: "FACULTY",
    role: "ADRIC_DIRECTOR",
    roleLabel: "AdRIC Director",
    accountStatus: "ACTIVE",
    labs: [],
    headOf: null,
  },
  {
    userId: 5,
    firstName: "Patricia",
    lastName: "Ramos",
    email: "patricia.ramos@dlsu.edu.ph",
    idNumber: 12100005,
    userType: "STAFF",
    role: "ADRIC_SECRETARY",
    roleLabel: "AdRIC Secretary",
    accountStatus: "ACTIVE",
    labs: [],
    headOf: null,
  },
  {
    userId: 6,
    firstName: "Carlos",
    lastName: "Dizon",
    email: "carlos.dizon@dlsu.edu.ph",
    idNumber: 12200006,
    userType: "STUDENT",
    role: "RESEARCHER",
    roleLabel: "Researcher",
    accountStatus: "INACTIVE",
    labs: [{ centerId: 3, code: "NLP" }],
    headOf: null,
  },
  {
    userId: 7,
    firstName: "Ana",
    lastName: "Valdez",
    email: "ana.valdez@dlsu.edu.ph",
    idNumber: 11700007,
    userType: "FACULTY",
    role: "RESEARCHER",
    roleLabel: "Researcher",
    accountStatus: "INACTIVE",
    labs: [{ centerId: 4, code: "ROB" }],
    headOf: { centerId: 4, code: "ROB" },
  },
];

/**
 * Lists the accounts for the IT Admin, showing role, lab memberships, Lab Head status, and status.
 * Provides placeholder actions to deactivate, reactivate, or anonymize user accounts.
 */
export function UsersPage() {
  const [userList, setUserList] = useState<ManagedUser[]>(INITIAL_MOCK_USERS);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

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

  const handleAnonymize = (userId: number) => {
    setUserList((prev) =>
      prev.map((u) =>
        u.userId === userId
          ? {
              ...u,
              firstName: "Anonymized",
              lastName: `User #${userId}`,
              email: `anonymized.${userId}@example.local`,
              idNumber: null,
            }
          : u
      )
    );
    setNotice(`User #${userId} anonymized.`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-foreground mb-1">{PAGE_TITLES.administration}</h1>
        <p className="text-muted-foreground text-sm">
          Users: view and manage active and inactive accounts.
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
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={statusFilter === tab ? "default" : "outline"}
              onClick={() => setStatusFilter(tab)}
            >
              {tab === "ALL" ? "All Users" : tab === "ACTIVE" ? "Active" : "Inactive"}
            </Button>
          ))}
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
              filteredUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="text-xs font-semibold">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell className="text-xs">{user.email}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {user.idNumber ?? "None"}
                  </TableCell>
                  <TableCell className="text-xs">{USER_TYPE_LABELS[user.userType]}</TableCell>
                  <TableCell className="text-xs font-medium">{user.roleLabel}</TableCell>
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
                    <Badge
                      variant={user.accountStatus === "ACTIVE" ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {user.accountStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {user.accountStatus === "ACTIVE" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                          onClick={() => handleDeactivate(user.userId)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          onClick={() => handleReactivate(user.userId)}
                        >
                          Reactivate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => handleAnonymize(user.userId)}
                      >
                        Anonymize
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

