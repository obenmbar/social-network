"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/api";
import styles from "./AuthNavbar.module.css";

export default function AuthNavbar({ user }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const avatarInitial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <header className={styles.navbar}>
      <Link href="/" className={styles.titleLink}>
        Ophanim
      </Link>

      <nav className={styles.navActions} aria-label="Main navigation">
        <Link href="/groups" className={styles.navLink}>
          Groups
        </Link>

        <button type="button" className={styles.iconButton} aria-label="Messages">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.3A8 8 0 1 1 21 12Z" />
          </svg>
        </button>

        <button type="button" className={styles.iconButton} aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
            <path d="M10 21h4" />
          </svg>
        </button>

        <div className={styles.avatarMenu}>
          <button type="button" className={styles.avatarButton} aria-label="Account menu">
            {user?.avatar ? (
              <span
                className={styles.avatarImage}
                style={{ backgroundImage: `url(${user.avatar})` }}
              />
            ) : (
              <span className={styles.avatarInitial}>{avatarInitial}</span>
            )}
          </button>

          <div className={styles.menuList}>
            <Link href="/profile" className={styles.menuItem}>
              Profile
            </Link>
            <button
              type="button"
              className={styles.menuItem}
              onClick={handleLogout}
              disabled={isLoading}
            >
              {isLoading ? "Logging out..." : "Logout"}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
