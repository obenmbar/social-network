"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "@/lib/api";
import Notification from "@/components/ui/Notification";
import styles from "./Feed.module.css";

export default function Feed() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });

  useEffect(() => {
    let isMounted = true;

    getCurrentUser()
      .then((data) => {
        if (isMounted) {
          setUser(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          router.replace("/login");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const closeNotification = () => {
    setNotification({ message: "", type: "" });
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      setNotification({ message: "Logout failed. Please try again.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const avatarInitial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className={styles.feedContainer}>
      <Notification 
        message={notification.message} 
        type={notification.type} 
        onClose={closeNotification} 
      />
      
      <header className={styles.navbar}>
        <Link href="/" className={styles.titleLink}>
          Ophanim
        </Link>

        <nav className={styles.navActions} aria-label="Main navigation">
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

      <main className={styles.mainContent}>
        <section className={styles.welcomeSection}>
          <h2>Welcome{user?.first_name ? `, ${user.first_name}` : ""}</h2>
          <p>Discover what is new today.</p>
        </section>

        <section className={styles.postsSection}>
          <div className={styles.postPlaceholder}>
            <div className={styles.avatarPlaceholder}></div>
            <div className={styles.contentPlaceholder}>
              <div className={styles.linePlaceholder}></div>
              <div className={styles.linePlaceholderShort}></div>
            </div>
          </div>
          
          <div className={styles.postPlaceholder}>
            <div className={styles.avatarPlaceholder}></div>
            <div className={styles.contentPlaceholder}>
              <div className={styles.linePlaceholder}></div>
              <div className={styles.linePlaceholder}></div>
              <div className={styles.linePlaceholderShort}></div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
