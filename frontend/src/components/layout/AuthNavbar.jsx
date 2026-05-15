"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/api";
import { removeSession } from "@/lib/session";
import NavIcons from "./NavIcons";
import styles from "./AuthNavbar.module.css";

export default function AuthNavbar({ user, theme, setTheme }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const avatarInitial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";

  const handleLogout = async () => {
    setIsLoading(true);
    removeSession();
    router.replace("/login");

    try {
      await logout();
    } catch {
      // The local session is already cleared; logout is best-effort server cleanup.
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
        <button 
          onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
        <Link href="/groups" className={styles.navLink}>
          Groups
        </Link>

        <NavIcons />

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
