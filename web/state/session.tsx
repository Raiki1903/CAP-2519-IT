/**
 * Session state: who is logged in, their role and profile, and their display preferences.
 * Layer: shared (web state). Called by App.tsx (the provider) and by every screen through useSession().
 * Calls api/auth.api.ts and api/client.ts (the 401 handler). Holds no asset, loan, or other workflow data: that is serverData.tsx.
 * Used by: every role.
 */
import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { Role, StaffUnit } from "@shared/enums/role";
import * as authApi from "../api/auth.api";
import { setUnauthorizedHandler } from "../api/client";

/**
 * The one readable cookie a login leaves: "1", meaning "a login exists", with no personal data. A page load asks /me
 * only when it is there; the server reads the HttpOnly adric_session cookie, which page scripts cannot see.
 */
export const SESSION_MARKER_COOKIE = "session_active";
/** The marker lasts as long as the server's session: 8 hours. */
export const SESSION_MARKER_DAYS = 8 / 24;
/** The three display cookies before 13c (email, login time, last activity). Erased on every page load. */
const OLD_SESSION_COOKIES = ["session_user_email", "session_last_activity", "session_created"];

/**
 * Writes a browser cookie for the whole site.
 *
 * @param name cookie name
 * @param value stored URL-encoded
 * @param days lifetime in days. Left out, the cookie lasts until the browser closes
 */
export function setCookie(name: string, value: string, days?: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
}

/**
 * Reads a browser cookie.
 *
 * @param name cookie name
 * @returns the decoded value, or null when the cookie is not set
 */
export function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

/**
 * Deletes a browser cookie by giving it an expiry date in the past.
 *
 * @param name cookie name
 */
export function eraseCookie(name: string) {
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

/**
 * The logged-in person, as `GET /api/auth/me` returns them.
 * The picture arrives under one name and is copied to all three
 * (`profilePicture`, `userImg`, `avatarUrl`), because screens read different ones.
 */
// TODO(H-13): several screens read user_id, first_name, last_name, id, and center_id, which are not on this object, and get undefined. Own fix branch.
export interface SessionUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  /** The database user type, for example "STUDENT" or "FACULTY". */
  userType: string;
  profilePicture?: string;
  userImg?: string;
  avatarUrl?: string;
  /** Short code of the person's first research center, for example "CITe4D". */
  labAffiliation?: string;
  /** ITS or TSG for a Staff account, null for every other role. See `StaffUnit`. */
  staffUnit?: StaffUnit | null;
}

interface SessionContextType {
  role: Role | null;
  setRole: (role: Role | null) => void;
  currentUser: SessionUser | null;
  updateProfile: (firstName: string, lastName: string, profilePicture: string) => Promise<void>;
  cycleMode: "Annual" | "Trimestral";
  setCycleMode: (mode: "Annual" | "Trimestral") => void;
  theme: "classic-dark" | "light-slate";
  setTheme: (t: "classic-dark" | "light-slate") => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  /** True after the server refused the session (a 401), until the next login. The login page says so. */
  sessionEnded: boolean;
  /** True while a page load is asking the server who is logged in. RootLayout waits instead of sending the person to /login. (issue #49) */
  restoring: boolean;
  /** Which of the RESTORE_ATTEMPTS the restore is on, from 1. RootLayout says so after the first. */
  restoreAttempt: number;
  /** True when every restore attempt failed for a reason other than a 401. The session is kept; RootLayout offers Retry. */
  restoreFailed: boolean;
  /** Runs the restore again, after restoreFailed. */
  retryRestore: () => void;
}

// A page load asks /me up to three times before it gives up, because the CCS Cloud link can be slow or fail for a
// moment (issue #8). Only a 401 means the session is gone; a 500, no answer, or a network error is retried.
const RESTORE_ATTEMPTS = 3;
const RESTORE_RETRY_DELAY_MS = 3000;
const RESTORE_TIMEOUT_MS = 20000;

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

type RestoreOutcome =
  | { kind: "user"; user: any }
  | { kind: "loggedOut" }
  | { kind: "unreachable" };

/**
 * Asks /me once who the session cookie belongs to, giving up after RESTORE_TIMEOUT_MS.
 *
 * @returns "user" with the profile; "loggedOut" for a 401 (the 401 handler has already cleared the session) or a 400 or
 *   404 (the server answered: it does not know this email); "unreachable" for a 5xx, no answer, or a network error
 */
async function askWhoIsLoggedIn(): Promise<RestoreOutcome> {
  try {
    const res = await Promise.race([
      authApi.getMeRaw(),
      wait(RESTORE_TIMEOUT_MS).then((): never => { throw new Error("timeout"); }),
    ]);
    if (res.status === 401 || res.status === 400 || res.status === 404) return { kind: "loggedOut" };
    if (!res.ok) return { kind: "unreachable" };
    const data = await res.json();
    return data?.success && data.user ? { kind: "user", user: data.user } : { kind: "unreachable" };
  } catch {
    return { kind: "unreachable" };
  }
}

const SessionContext = createContext<SessionContextType | null>(null);

/**
 * Holds the session and the preferences, and shares them through useSession().
 * On page load, when the login marker cookie is there, it asks authApi.getMe for the role and profile
 * of the session's own account. Preferences are kept in cookies too.
 *
 * What it shares:
 * - `role`, `currentUser`: null while logged out.
 * - `setRole(role)`: logs in (loads the profile with authApi.getMe) or, with null, logs out on the server
 *   (authApi.logout) and clears the login marker.
 * - `sessionEnded`: true after the server refused the session (a 401 while this tab was logged in or restoring),
 *   until the next login.
 * - `restoring`: true while a page load waits for /me, so RootLayout does not redirect yet (issue #49).
 *   `restoreAttempt` says which try it is on.
 * - `restoreFailed`, `retryRestore()`: every try failed for a reason other than a 401 (a 500, no answer, a network
 *   error). The person stays where they are, with the login marker kept, and RootLayout offers Retry.
 * - `updateProfile(...)`: saves name and picture with authApi.updateAccount. The lab is read-only on the account page,
 *   so none is sent; the session takes the account's lab from the answer (issue #73).
 * - `cycleMode`, `theme`, `sidebarCollapsed` and their setters.
 *
 * @param children the rest of the app
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  // Starts true exactly when the effect below will ask /me, so the first render already waits.
  const [restoring, setRestoring] = useState<boolean>(() => !!getCookie(SESSION_MARKER_COOKIE));
  const [restoreAttempt, setRestoreAttempt] = useState(1);
  const [restoreFailed, setRestoreFailed] = useState(false);

  // Whether this tab has a session to lose: someone logged in here, or a page load restoring one. The 401 handler
  // reads it to decide on the notice. Not the login marker: every tab shares it, and a logout in another tab
  // has already erased it. A ref, because the handler is registered once and must see the latest value.
  const hasSessionHere = useRef(false);
  hasSessionHere.current = role !== null || currentUser !== null || restoring;

  // Keeps the login marker on a failure: the server's session cookie may well still be valid.
  const restoreSession = async () => {
    setRestoreFailed(false);
    setRestoring(true);
    for (let attempt = 1; attempt <= RESTORE_ATTEMPTS; attempt++) {
      setRestoreAttempt(attempt);
      const outcome = await askWhoIsLoggedIn();
      if (outcome.kind === "user") {
        const img = outcome.user.userImg || outcome.user.profilePicture || outcome.user.avatarUrl;
        setRoleState(outcome.user.role as Role);
        setCurrentUser({ ...outcome.user, profilePicture: img, userImg: img, avatarUrl: img } as any);
        setRestoring(false);
        return;
      }
      if (outcome.kind === "loggedOut") {
        // A 401 has cleared the session already; a 404 (the account is gone) clears the marker here.
        eraseCookie(SESSION_MARKER_COOKIE);
        setRoleState(null);
        setCurrentUser(null);
        setRestoring(false);
        return;
      }
      if (attempt < RESTORE_ATTEMPTS) await wait(RESTORE_RETRY_DELAY_MS);
    }
    setRestoring(false);
    setRestoreFailed(true);
  };

  const retryRestore = () => {
    if (getCookie(SESSION_MARKER_COOKIE)) restoreSession();
    else setRestoreFailed(false);
  };

  const clearSession = () => {
    hasSessionHere.current = false;
    setRoleState(null);
    setCurrentUser(null);
    eraseCookie(SESSION_MARKER_COOKIE);
  };

  // Any 401 means the server no longer accepts the session cookie (expired, logged out elsewhere,
  // or the secret changed), so the person is logged out here too and RootLayout sends them to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (hasSessionHere.current) setSessionEnded(true);
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // TODO(F-38): cycle mode is shown as a policy for the whole institution, but it is one cookie per browser. Phase 3.
  const [cycleMode, setCycleModeState] = useState<"Annual" | "Trimestral">(() => {
    const c = getCookie("pref_cycle_mode");
    return (c === "Annual" || c === "Trimestral") ? c : "Trimestral";
  });

  const [theme, setThemeState] = useState<"classic-dark" | "light-slate">(() => {
    const c = getCookie("pref_theme");
    return (c === "classic-dark" || c === "light-slate") ? c : "classic-dark";
  });

  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    return getCookie("pref_sidebar_collapsed") === "true";
  });

  // Tailwind's dark styles switch on a "dark" class on the <html> element.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "classic-dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Restores the session on page load.
  // The server's session is the HttpOnly adric_session cookie, which page scripts cannot read; the marker only says a
  // login exists, so /me is worth asking. /me answers for the session cookie's own account. A 401 here means that
  // session is gone, and the 401 handler logs the person out.
  // The three display cookies from before 13c are erased if present, so a browser that has only those (logged in
  // before the update) is sent to /login once.
  useEffect(() => {
    OLD_SESSION_COOKIES.forEach(eraseCookie);
    if (getCookie(SESSION_MARKER_COOKIE)) restoreSession();
  }, []);

  const setCycleMode = (mode: "Annual" | "Trimestral") => {
    setCycleModeState(mode);
    setCookie("pref_cycle_mode", mode, 365);
  };

  const setRole = (newRole: Role | null) => {
    if (newRole === null) {
      // The server forgets the session cookie even if this answer never arrives; the local logout does not wait for it.
      authApi.logout().catch(() => { });
      clearSession();
    } else {
      setRoleState(newRole);
      setSessionEnded(false);
      // The server answers /me for the session cookie login just set: the logged-in user's own profile.
      authApi.getMe()
        .then(data => {
          if (data.success && data.user) {
            const img = data.user.userImg || data.user.profilePicture || data.user.avatarUrl;
            setCurrentUser({
              ...data.user,
              profilePicture: img,
              userImg: img,
              avatarUrl: img
            } as any);
          }
        })
        .catch(() => { });
    }
  };

  // A failed save is only written to the console, so the account page shows success either way.
  const updateProfile = async (firstName: string, lastName: string, profilePicture: string) => {
    if (!currentUser) return;
    try {
      const data = await authApi.updateAccount({
        firstName,
        lastName,
        avatarUrl: profilePicture,
        profilePicture,
        userImg: profilePicture
      });
      if (data.success && data.user) {
        const savedImg = data.user.userImg || data.user.profilePicture || data.user.avatarUrl || profilePicture;
        setCurrentUser({
          ...currentUser,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          profilePicture: savedImg,
          userImg: savedImg,
          avatarUrl: savedImg,
          labAffiliation: data.user.labAffiliation
        } as any);
      }
    } catch (e) {
      console.error("Failed to update profile on server:", e);
    }
  };

  const setSidebarCollapsed = (v: boolean) => {
    setSidebarCollapsedState(v);
    setCookie("pref_sidebar_collapsed", String(v), 365);
  };

  const setTheme = (t: "classic-dark" | "light-slate") => {
    setThemeState(t);
    setCookie("pref_theme", t, 365);
  };

  return (
    <SessionContext.Provider
      value={{
        role, setRole,
        currentUser, updateProfile,
        cycleMode, setCycleMode,
        theme, setTheme,
        sidebarCollapsed, setSidebarCollapsed,
        sessionEnded, restoring, restoreAttempt, restoreFailed, retryRestore
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Gives a component the session and the preferences.
 *
 * @returns role, currentUser, setRole, updateProfile, and the three preferences with their setters
 * @throws Error if the component is not inside SessionProvider
 */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/** The first URL segment of each role's pages, for example `/lab-head/...`. */
export const roleToSlug: Record<Role, string> = {
  Staff: "staff",
  LabHead: "lab-head",
  Custodian: "custodian",
  AdRICDirector: "adric-director",
};

/** The name each role is shown by, on every screen (sidebar, mobile header, Preferences, the no-access screen). */
export const roleLabel: Record<Role, string> = {
  Staff: "Staff",
  LabHead: "Lab Head",
  Custodian: "Custodian",
  AdRICDirector: "AdRIC Director",
};

/** Where each role lands after login, and where the no-access and not-found screens send it. */
export const roleDefaultPath: Record<Role, string> = {
  Staff: "/staff/overview",
  LabHead: "/lab-head/custody",
  Custodian: "/custodian/myassets",
  AdRICDirector: "/adric-director/overview",
};
