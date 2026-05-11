"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, getCurrentUser } from "@/lib/api";
import { hasSession, removeSession, sessionStorageKey } from "@/lib/session";
import AuthNavbar from "./AuthNavbar";

const authRoutes = new Set(["/login", "/register"]);

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  const isAuthRoute = authRoutes.has(pathname);
  const sessionExists = hasSession();

  useEffect(() => {
    let isMounted = true;

    if (!sessionExists) {
      if (!isAuthRoute) {
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
          if (err instanceof ApiError && err.status === 401) {
            setUser(null);
            removeSession();
            router.replace("/login");
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthRoute, router, sessionExists]);

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
        router.replace("/login");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [router]);

  if (isAuthRoute) {
    return children;
  }

  if (!sessionExists || !user) {
    return null;
  }

  return (
    <>
      <AuthNavbar user={user} />
      {children}
    </>
  );
}
