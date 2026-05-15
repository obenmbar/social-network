"use client";

import React, { useEffect, useState } from "react";
import { getChatContacts, getFollowers, getFollowing, isUnauthorized, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function ChatSidebar({ onSelectUser, selectedUserId, isSidebarOnly = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unreadChatIds, lastActivityMap, markAsRead, setActiveChat } = useWebSocket();

  useEffect(() => {
    getPrivateContacts()
      .then(setUsers)
      .catch((err) => {
        if (!isUnauthorized(err)) {
          console.error("Failed to load users:", err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const sidebarActiveStyle = isSidebarOnly 
    ? { ...sidebarStyle, position: "static", height: "100%", borderLeft: "none", borderRight: "1px solid var(--border)", boxShadow: "none" } 
    : sidebarStyle;

  const handleSelect = (user) => {
    const selectedUser = { ...user, type: "private" };
    // Step 3 & 4: Clear Local 'New' Badge & Bind markAsRead to Sidebar Click
    markAsRead(selectedUser.id, "private");
    setActiveChat(selectedUser); // Ensure active chat guard works
    onSelectUser(selectedUser);
  };

  // Dynamic sorting for users
  const sortedUsers = [...users].sort((a, b) => {
    const lastA = lastActivityMap[`private_${a.id}`] || (a.last_activity ? new Date(a.last_activity).getTime() : 0);
    const lastB = lastActivityMap[`private_${b.id}`] || (b.last_activity ? new Date(b.last_activity).getTime() : 0);
    
    // Sort by last activity descending
    if (lastB !== lastA) return lastB - lastA;
    
    // Fallback to alphabetical (first name + last name, then nickname)
    const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.nickname || "";
    const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.nickname || "";
    return nameA.localeCompare(nameB);
  });

  return (
    <aside style={sidebarActiveStyle}>
      <h3 style={headerStyle}>Messages</h3>
      {loading ? (
        <p style={{ padding: "0.5rem 1rem" }}>Loading...</p>
      ) : sortedUsers.length === 0 ? (
        <p style={{ padding: "0.5rem 1rem" }}>No conversations found.</p>
      ) : (
        <ul style={listStyle}>
          {sortedUsers.map((user) => {
            const isUnread = unreadChatIds.includes(`private_${user.id}`);
            return (
              <li 
                key={user.id} 
                style={{
                  ...itemStyle,
                  background: selectedUserId === user.id ? "var(--bg-selected)" : "transparent"
                }}
                onClick={() => handleSelect(user)}
              >
                <div style={avatarContainer}>
                  {user.avatar ? (
                    <img src={mediaUrl(user.avatar)} alt="" style={avatarStyle} />
                  ) : (
                    <div style={placeholderAvatar}>
                      {user.first_name?.[0] || "?"}
                    </div>
                  )}
                  {isUnread && <span style={onlineDot} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={nameStyle}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div style={nicknameStyle}>
                    @{user.nickname || "user"}
                    {user.can_message === false ? " · read only" : ""}
                  </div>
                </div>
                {isUnread && (
                  <span style={newBadgeStyle}>New</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

async function getPrivateContacts() {
  try {
    return await getChatContacts();
  } catch (err) {
    if (err?.status !== 404) {
      throw err;
    }
    const [followers = [], following = []] = await Promise.all([getFollowers(), getFollowing()]);
    return mergeChatUsers(followers, following);
  }
}

function mergeChatUsers(followers, following) {
  const usersById = new Map();

  [...followers, ...following].forEach((user) => {
    if (!user?.id || usersById.has(user.id)) return;
    usersById.set(user.id, { ...user, can_message: true });
  });

  return Array.from(usersById.values());
}

const sidebarStyle = {
  position: "fixed",
  right: 0,
  top: "60px", 
  width: "300px",
  height: "calc(100vh - 60px)",
  background: "var(--background)",
  borderLeft: "1px solid var(--border)",
  boxShadow: "-2px 0 5px rgba(0,0,0,0.05)",
  zIndex: 1000,
  overflowY: "auto",
};

const headerStyle = {
  padding: "1rem",
  margin: 0,
  borderBottom: "1px solid var(--border)",
  fontSize: "1.1rem",
  color: "var(--foreground)",
};

const listStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const itemStyle = {
  display: "flex",
  alignItems: "center",
  padding: "0.75rem 1rem",
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
  transition: "background 0.2s",
  color: "var(--foreground)",
};

const avatarContainer = {
  position: "relative",
  marginRight: "0.75rem",
};

const avatarStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  objectFit: "cover",
};

const placeholderAvatar = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: "var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  color: "var(--muted-foreground)",
};

const onlineDot = {
  position: "absolute",
  bottom: "2px",
  right: "2px",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "#4caf50",
  border: "2px solid var(--background)",
};

const nameStyle = {
  fontWeight: "bold",
  fontSize: "0.95rem",
};

const nicknameStyle = {
  fontSize: "0.85rem",
  color: "var(--muted-foreground)",
};

const unreadBadge = {
  background: "#ff4d4f",
  color: "var(--text-bubble-me)",
  fontSize: "10px",
  padding: "2px 6px",
  borderRadius: "10px",
  fontWeight: "bold",
};

const newBadgeStyle = { color: "var(--error)", fontSize: "12px", fontWeight: "bold" };
