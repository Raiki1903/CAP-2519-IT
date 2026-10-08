/**
 * Session state: who is logged in, their role and profile, and their display preferences.
 * Layer: shared (web state). Called by App.tsx (the provider) and by every screen through useSession().
 * Calls api/auth.api.ts. Holds no asset, loan, or other workflow data: that is serverData.tsx.
 * Used by: every role.
 */
import { createContext, useContext, useState, useEffect } from "react";
import type { Role, StaffUnit } from "@shared/enums/role";
import * as authApi from "../api/auth.api";

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
  staffUnit?: StaffUnit | null;
}

interface SessionContextType {
  role: Role | null;
  setRole: (role: Role | null) => void;
  currentUser: SessionUser | null;
  updateProfile: (firstName: string, lastName: string, profilePicture: string, labAffiliation?: string) => Promise<void>;
  cycleMode: "Annual" | "Trimestral";
  setCycleMode: (mode: "Annual" | "Trimestral") => void;
  theme: "classic-dark" | "light-slate";
  setTheme: (t: "classic-dark" | "light-slate") => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

/**
 * Holds the session and the preferences, and shares them through useSession().
 * On page load it restores the session from three cookies and asks
 * authApi.getMe for the role and profile. Preferences are kept in cookies too.
 *
 * What it shares:
 * - `role`, `currentUser`: null while logged out.
 * - `setRole(role)`: logs in (loads the profile with authApi.getMe) or, with null, logs out and clears the session cookies.
 * - `updateProfile(...)`: saves name, picture, and lab with authApi.updateAccount.
 * - `cycleMode`, `theme`, `sidebarCollapsed` and their setters.
 *
 * @param children the rest of the app
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

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
  // TODO(C-06): the session is an unsigned cookie holding an email, and the server returns whatever role that email has. Step 13 (requireAuth).
  useEffect(() => {
    const sessionEmail = getCookie("session_user_email");
    const lastActivityStr = getCookie("session_last_activity");
    const sessionCreatedStr = getCookie("session_created");

    if (sessionEmail && lastActivityStr && sessionCreatedStr) {
      const now = Date.now();
      const lastActivity = parseInt(lastActivityStr, 10);
      const sessionCreated = parseInt(sessionCreatedStr, 10);

      const oneDayMs = 24 * 60 * 60 * 1000;
      const thirtyDaysMs = 30 * oneDayMs;

      // Two limits: 24 hours without a page load, and 30 days in total.
      if (now - lastActivity > oneDayMs) {
        setRoleState(null);
        eraseCookie("session_user_email");
        eraseCookie("session_last_activity");
        eraseCookie("session_created");
        alert("Session expired due to 24 hours of inactivity. Please log in again.");
      } else if (now - sessionCreated > thirtyDaysMs) {
        setRoleState(null);
        eraseCookie("session_user_email");
        eraseCookie("session_last_activity");
        eraseCookie("session_created");
        alert("Your session has reached its 30-day limit. Please log in again.");
      } else {
        setCookie("session_last_activity", String(now), 1);

        authApi.getMe(sessionEmail)
          .then(data => {
            if (data.success && data.user) {
              setRoleState(data.user.role as Role);
              const img = data.user.userImg || data.user.profilePicture || data.user.avatarUrl;
              setCurrentUser({
                ...data.user,
                profilePicture: img,
                userImg: img,
                avatarUrl: img
              } as any);
            } else {
              // The server does not know this email, so the person is logged out.
              // The cookies are left in place and the same check runs on the next load.
              setRoleState(null);
              setCurrentUser(null);
            }
          })
          .catch(() => {
            setRoleState(null);
            setCurrentUser(null);
          });
      }
    }
  }, []);

  const setCycleMode = (mode: "Annual" | "Trimestral") => {
    setCycleModeState(mode);
    setCookie("pref_cycle_mode", mode, 365);
  };

  const setRole = (newRole: Role | null) => {
    setRoleState(newRole);
    if (newRole === null) {
      eraseCookie("session_user_email");
      eraseCookie("session_last_activity");
      eraseCookie("session_created");
      setCurrentUser(null);
    } else {
      setCookie("session_last_activity", String(Date.now()), 1);
      // Login.tsx writes the email cookie before it calls setRole, so the profile can be loaded here.
      const email = getCookie("session_user_email");
      if (email) {
        authApi.getMe(email)
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
    }
  };

  // A failed save is only written to the console, so the account page shows success either way.
  const updateProfile = async (firstName: string, lastName: string, profilePicture: string, labAffiliation?: string) => {
    if (!currentUser) return;
    try {
      const data = await authApi.updateAccount({
        email: currentUser.email,
        firstName,
        lastName,
        avatarUrl: profilePicture,
        profilePicture,
        userImg: profilePicture,
        labAffiliation
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
        sidebarCollapsed, setSidebarCollapsed
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

/** Where each role lands after login, and when it opens a URL that belongs to another role. */
export const roleDefaultPath: Record<Role, string> = {
  Staff: "/staff/overview",
  LabHead: "/lab-head/custody",
  Custodian: "/custodian/myassets",
  AdRICDirector: "/adric-director/overview",
};
