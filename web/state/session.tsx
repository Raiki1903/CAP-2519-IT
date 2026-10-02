import { createContext, useContext, useState, useEffect } from "react";
import type { Role } from "@shared/enums/role";
import * as authApi from "../api/auth.api";

// ── Cookie Helper Functions ────────────────────────────────────────────────
export function setCookie(name: string, value: string, days?: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
}

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

export function eraseCookie(name: string) {
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

export interface SessionUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  idNumber: number;
  userType: string;
  profilePicture?: string;
  userImg?: string;
  avatarUrl?: string;
  labAffiliation?: string;
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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  // Load preferences from cookies
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

  // Set up preferences color schema in class list
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "classic-dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Session activity verification & decay checks
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

      if (now - lastActivity > oneDayMs) {
        // Session expired due to 24h inactivity
        setRoleState(null);
        eraseCookie("session_user_email");
        eraseCookie("session_last_activity");
        eraseCookie("session_created");
        alert("Session expired due to 24 hours of inactivity. Please log in again.");
      } else if (now - sessionCreated > thirtyDaysMs) {
        // Session expired due to 30 days max lifespan
        setRoleState(null);
        eraseCookie("session_user_email");
        eraseCookie("session_last_activity");
        eraseCookie("session_created");
        alert("Your session has reached its 30-day limit. Please log in again.");
      } else {
        // Session valid! Reset activity timer to now + 24 hours
        setCookie("session_last_activity", String(now), 1);

        // Session valid! Fetch live user from MySQL DB in Prisma Studio
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

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export const roleToSlug: Record<Role, string> = {
  ITS: "its",
  TSG: "tsg",
  LabHead: "lab-head",
  Custodian: "custodian",
  AdRICDirector: "adric-director",
};

export const roleDefaultPath: Record<Role, string> = {
  ITS: "/its/overview",
  TSG: "/tsg/repairs",
  LabHead: "/lab-head/custody",
  Custodian: "/custodian/myassets",
  AdRICDirector: "/adric-director/overview",
};
