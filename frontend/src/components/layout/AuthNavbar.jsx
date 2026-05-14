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

    try {
      await logout();
    } finally {
      removeSession();
      router.replace("/login");
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
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
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
