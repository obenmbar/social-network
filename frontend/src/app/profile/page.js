"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getCurrentUser,
  getFollowRequests,
  getFollowing,
  getFollowers,
  isUnauthorized,
  mediaUrl,
  respondToFollowRequest,
  updateProfileVisibility,
} from "@/lib/api";
import styles from "./Profile.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadProfileData()
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        if (isUnauthorized(err)) {
          router.replace("/login");
        } else {
          setError(err.message || "Could not load profile");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    async function loadProfileData() {
      const [currentUser, followerList, followingList, requestList] = await Promise.all([
        getCurrentUser(),
        getFollowers(),
        getFollowing(),
        getFollowRequests(),
      ]);

      if (!isMounted) {
        return;
      }
      setUser(currentUser);
      setFollowers(followerList || []);
      setFollowing(followingList || []);
      setRequests(requestList || []);
    }

    return () => {
      isMounted = false;
    };
  }, [router]);

  const refreshFollowLists = async () => {
    const [followerList, followingList, requestList] = await Promise.all([
      getFollowers(),
      getFollowing(),
      getFollowRequests(),
    ]);
    setFollowers(followerList || []);
    setFollowing(followingList || []);
    setRequests(requestList || []);
  };

  const handleRequestResponse = async (requestId, status) => {
    setBusyId(requestId);
    setError("");
    try {
      await respondToFollowRequest(requestId, status);
      await refreshFollowLists();
    } catch (err) {
      setError(err.message || "Could not update request");
    } finally {
      setBusyId("");
    }
  };

  const handleVisibilityChange = async () => {
    if (!user) {
      return;
    }
    const nextVisibility = !user.is_public;
    setBusyId("visibility");
    setError("");
    try {
      await updateProfileVisibility(nextVisibility);
      setUser((current) => ({ ...current, is_public: nextVisibility }));
      await refreshFollowLists();
    } catch (err) {
      setError(err.message || "Could not update profile visibility");
    } finally {
      setBusyId("");
    }
  };

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

        <div className={styles.profileInfo}>
          <h1>{user ? `${user.first_name} ${user.last_name}` : "Profile"}</h1>
          {user?.nickname && <p className={styles.nickname}>@{user.nickname}</p>}
          {user?.about_me && <p className={styles.about}>{user.about_me}</p>}
          <div className={styles.metaRow}>
            <span>{followers.length} followers</span>
            <span>{following.length} following</span>
            <span>{user?.is_public ? "Public profile" : "Private profile"}</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleVisibilityChange}
          disabled={busyId === "visibility"}
        >
          {user?.is_public ? "Make Private" : "Make Public"}
        </button>
      </section>

      {error && <p className={styles.errorMessage}>{error}</p>}

      <div className={styles.profileGrid}>
        <section className={styles.sectionPanel}>
          <h2>Follow Requests</h2>
          {isLoading ? (
            <p className={styles.emptyState}>Loading requests...</p>
          ) : requests.length === 0 ? (
            <p className={styles.emptyState}>No pending follow requests.</p>
          ) : (
            <div className={styles.userList}>
              {requests.map((request) => (
                <UserRow key={request.id} user={request.requester}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => handleRequestResponse(request.id, "accepted")}
                    disabled={busyId === request.id}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => handleRequestResponse(request.id, "declined")}
                    disabled={busyId === request.id}
                  >
                    Decline
                  </button>
                </UserRow>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

function UserRow({ user, children }) {
  return (
    <div className={styles.userRow}>
      <MiniAvatar user={user} />
      <div className={styles.userText}>
        <strong>{displayName(user)}</strong>
        <span>@{mentionHandle(user)}</span>
      </div>
      {children && <div className={styles.rowActions}>{children}</div>}
    </div>
  );
}

function MiniAvatar({ user }) {
  const initial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";
  return (
    <span className={styles.miniAvatar}>
      {user?.avatar ? (
        <span
          className={styles.avatarImage}
          style={{ backgroundImage: `url(${mediaUrl(user.avatar)})` }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  );
}

function displayName(user) {
  return `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "User";
}

function mentionHandle(user) {
  return user?.nickname || displayName(user).toLowerCase().replace(/\s+/g, ".") || "user";
}
