"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getCurrentUser, mediaUrl } from "@/lib/api";
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
      .catch((err) => {
        if (isMounted) {
          if (err instanceof ApiError && err.status === 401) {
            router.replace("/login");
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const avatarInitial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";

  return (
    <main className={styles.profilePage}>
      <section className={styles.profilePanel}>
        <div className={styles.avatar}>
          {user?.avatar ? (
            <span
              className={styles.avatarImage}
              style={{ backgroundImage: `url(${mediaUrl(user.avatar)})` }}
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
