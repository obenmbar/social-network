"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/api";
import styles from "./Profile.module.css";

export default function ProfilePage() {
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

  const avatarInitial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <main className={styles.profilePage}>
      <nav className={styles.navbar}>
        <Link href="/" className={styles.backLink}>
          Ophanim
        </Link>
      </nav>

      <section className={styles.profilePanel}>
        <div className={styles.avatar}>
          {user?.avatar ? (
            <span
              className={styles.avatarImage}
              style={{ backgroundImage: `url(${user.avatar})` }}
            />
          ) : (
            <span className={styles.avatarInitial}>{avatarInitial}</span>
          )}
        </div>

        <div>
          <h1>
            {user ? `${user.first_name} ${user.last_name}` : "Profile"}
          </h1>
          {user?.nickname && <p className={styles.nickname}>@{user.nickname}</p>}
          {user?.about_me && <p className={styles.about}>{user.about_me}</p>}
        </div>
      </section>
    </main>
  );
}
