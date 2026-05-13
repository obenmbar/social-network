"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, isUnauthorized, logout } from "@/lib/api";
import { hasSession, removeSession, sessionStorageKey } from "@/lib/session";
import AuthNavbar from "./AuthNavbar";

const authRoutes = new Set(["/login", "/register"]);

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  const isAuthRoute = authRoutes.has(pathname);
  const hasLocalSession = hasSession();

  useEffect(() => {
    let isMounted = true;

    if (!hasLocalSession) {
      if (!isAuthRoute) {
        logout().catch(() => {});
        router.replace("/login");
      }
      return () => {
        isMounted = false;
      };
    }

    if (isAuthRoute) {
      router.replace("/");
      return () => {
        isMounted = false;
      };
    }

    getCurrentUser()
      .then((data) => {
        if (isMounted) {
          setUser(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          if (isUnauthorized(err)) {
            setUser(null);
            removeSession();
            router.replace("/login");
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hasLocalSession, isAuthRoute, router]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== sessionStorageKey) {
        return;
      }

      if (event.newValue === "active") {
        if (authRoutes.has(window.location.pathname)) {
          router.replace("/");
        }
        return;
      }

      setUser(null);
      if (!authRoutes.has(window.location.pathname)) {
        logout().catch(() => {});
        router.replace("/login");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [router]);

  useEffect(() => {
    const logoutIfLocalSessionWasRemoved = () => {
      if (authRoutes.has(window.location.pathname)) {
        return;
      }
      if (hasSession()) {
        return;
      }

      setUser(null);
      logout().catch(() => {});
      if (!authRoutes.has(window.location.pathname)) {
        router.replace("/login");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        logoutIfLocalSessionWasRemoved();
      }
    };

    window.addEventListener("focus", logoutIfLocalSessionWasRemoved);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", logoutIfLocalSessionWasRemoved);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  if (isAuthRoute) {
    return children;
  }

  // If session exists locally, render content immediately to avoid 'freeze' 
  // until getCurrentUser resolves.
  if (hasLocalSession) {
    return (
      <>
        {user && <AuthNavbar user={user} />}
        {children}
      </>
    );
  }

  // If no session, wait for useEffect to redirect
  return null;
}
