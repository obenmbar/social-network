"use client";

import React, { useEffect, useState } from "react";
import { getFollowers, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function ChatSidebar({ onSelectUser, selectedUserId, isSidebarOnly = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { realtimeNotifications, markAsRead, setActiveChat } = useWebSocket();

  useEffect(() => {
    getFollowers()
      .then(setUsers)
      .catch((err) => console.error("Failed to load users:", err))
      .finally(() => setLoading(false));
  }, []);

  // Set of user IDs who have unread messages in the current session
  const unreadUserIds = new Set(realtimeNotifications.filter(m => !m.type).map((m) => m.sender_id));

  const sidebarActiveStyle = isSidebarOnly 
    ? { ...sidebarStyle, position: "static", height: "100%", borderLeft: "none", borderRight: "1px solid #333", boxShadow: "none" } 
    : sidebarStyle;

  const handleSelect = (user) => {
    // Step 3 & 4: Clear Local 'New' Badge & Bind markAsRead to Sidebar Click
    markAsRead(user.id);
    setActiveChat({ ...user, type: "private" }); // Ensure active chat guard works
    onSelectUser(user);
  };

  return (
    <aside style={sidebarActiveStyle}>
      <h3 style={headerStyle}>Messages</h3>
      {loading ? (
        <p style={{ padding: "0.5rem 1rem" }}>Loading...</p>
      ) : users.length === 0 ? (
        <p style={{ padding: "0.5rem 1rem" }}>No followers found.</p>
      ) : (
        <ul style={listStyle}>
          {users.map((user) => (
            <li 
              key={user.id} 
              style={{
                ...itemStyle,
                background: selectedUserId === user.id ? "#2c3e50" : "transparent"
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
                {unreadUserIds.has(user.id) && <span style={onlineDot} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={nameStyle}>
                  {user.first_name} {user.last_name}
                </div>
                <div style={nicknameStyle}>@{user.nickname || "user"}</div>
              </div>
              {unreadUserIds.has(user.id) && (
                <span style={unreadBadge}>New</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

const sidebarStyle = {
  position: "fixed",
  right: 0,
  top: "60px", 
  width: "300px",
  height: "calc(100vh - 60px)",
  background: "#121212",
  borderLeft: "1px solid #333",
  boxShadow: "-2px 0 5px rgba(0,0,0,0.05)",
  zIndex: 1000,
  overflowY: "auto",
};

const headerStyle = {
  padding: "1rem",
  margin: 0,
  borderBottom: "1px solid #333",
  fontSize: "1.1rem",
  color: "white",
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
  borderBottom: "1px solid #333",
  cursor: "pointer",
  transition: "background 0.2s",
  color: "white",
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
  background: "#333",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  color: "#888",
};

const onlineDot = {
  position: "absolute",
  bottom: "2px",
  right: "2px",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  background: "#4caf50",
  border: "2px solid white",
};

const nameStyle = {
  fontWeight: "bold",
  fontSize: "0.95rem",
};

const nicknameStyle = {
  fontSize: "0.85rem",
  color: "#aaaaaa",
};

const unreadBadge = {
  background: "#ff4d4f",
  color: "white",
  fontSize: "10px",
  padding: "2px 6px",
  borderRadius: "10px",
  fontWeight: "bold",
};
