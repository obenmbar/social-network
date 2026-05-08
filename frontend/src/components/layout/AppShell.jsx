"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import AuthNavbar from "./AuthNavbar";

const authRoutes = new Set(["/login", "/register"]);

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  const isAuthRoute = authRoutes.has(pathname);

  useEffect(() => {
    let isMounted = true;

    if (isAuthRoute) {
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
      .catch(() => {
        if (isMounted) {
          setUser(null);
          router.replace("/login");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthRoute, router]);

  if (isAuthRoute) {
    return children;
  }

  return (
    <>
      {user && <AuthNavbar user={user} />}
      {children}
    </>
  );
}
