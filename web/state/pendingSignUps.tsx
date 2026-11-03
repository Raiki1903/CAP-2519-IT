/**
 * Pending sign-ups state: the IT Admin's waiting sign-ups, shared by the Approvals page and the sidebar's count.
 * Layer: shared (web state). Called by App.tsx (the provider), pages/it-admin/ApprovalsPage.tsx and app/layouts/Sidebar.tsx
 * through usePendingSignUps(). Calls api/users.api.ts and state/session.tsx (the role).
 * Used by: the IT Admin.
 * It loads only for the IT Admin: the server answers 403 to every other role.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@shared/types/users";
import * as usersApi from "../api/users.api";
import { useSession } from "./session";

interface PendingSignUpsValue {
  /** The sign-ups waiting, oldest first. Empty for every role but the IT Admin. */
  users: User[];
  /** True until the first load of this session finishes. */
  loading: boolean;
  /** The server's sentence (or a plain one) when the last load failed, otherwise null. */
  error: string | null;
  /** Loads the list again. */
  reload: () => Promise<void>;
  /** Takes a decided sign-up out of the list without another request. */
  remove: (userId: number) => void;
}

const PendingSignUpsContext = createContext<PendingSignUpsValue | null>(null);

/**
 * Holds the pending sign-ups for the IT Admin and loads them when that role logs in. A logout empties the list, so the
 * next person in this tab never sees it.
 *
 * @param children the app
 */
export function PendingSignUpsProvider({ children }: { children: ReactNode }) {
  const { role } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.listPendingUsers();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        setError(null);
      } else {
        setError(data.error || "Could not load the sign-ups. Try again.");
      }
    } catch {
      setError("Can't reach the server right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role !== "ITAdmin") {
      setUsers([]);
      setError(null);
      setLoading(false);
      return;
    }
    reload();
  }, [role, reload]);

  const remove = useCallback((userId: number) => {
    setUsers(prev => prev.filter(u => u.userId !== userId));
  }, []);

  return (
    <PendingSignUpsContext.Provider value={{ users, loading, error, reload, remove }}>
      {children}
    </PendingSignUpsContext.Provider>
  );
}

/**
 * Gives a component the pending sign-ups.
 *
 * @returns users, loading, error, reload, and remove
 * @throws Error if the component is not inside PendingSignUpsProvider
 */
export function usePendingSignUps(): PendingSignUpsValue {
  const ctx = useContext(PendingSignUpsContext);
  if (!ctx) throw new Error("usePendingSignUps must be used inside PendingSignUpsProvider");
  return ctx;
}
