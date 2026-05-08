"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/api";
import styles from "./Feed.module.css";

export default function Feed() {
  const router = useRouter();
  const [user, setUser] = useState(null);

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

  return (
    <div className={styles.feedContainer}>
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
