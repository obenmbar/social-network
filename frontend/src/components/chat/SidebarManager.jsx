"use client";

import React, { useState, useEffect } from "react";
import { getFollowers, getGroups, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function SidebarManager({ onSelectTarget, selectedTargetId }) {
  const [activeTab, setActiveTab] = useState("private"); // 'private' or 'group'
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { realtimeNotifications, markAsRead, setActiveChat } = useWebSocket();

  useEffect(() => {
    setLoading(true);
    const fetchData = activeTab === "private" ? getFollowers() : getGroups();
    
    fetchData
      .then((data) => {
        if (activeTab === "private") setUsers(data || []);
        else setGroups(data || []);
      })
      .catch((err) => console.error(`Failed to load ${activeTab}:`, err))
      .finally(() => setLoading(false));
  }, [activeTab]);

  // Determine which tabs have unread messages using realtimeNotifications
  const hasPrivateUnread = realtimeNotifications.some(m => !m.type && m.receiver_id && !m.group_id);
  const hasGroupUnread = realtimeNotifications.some(m => !m.type && m.group_id);

  const handleSelect = (target) => {
    // Step 3 & 4: Clear Local 'New' Badge & Bind markAsRead to Sidebar Click
    markAsRead(target.id);
    setActiveChat(target); // Ensure active chat guard works in context
    onSelectTarget(target);
  };

  return (
    <div style={sidebarContainerStyle}>
      <div style={tabContainerStyle}>
        <button 
          onClick={() => setActiveTab("private")}
          style={{
            ...tabStyle,
            borderBottom: activeTab === "private" ? "3px solid #007bff" : "3px solid transparent",
            color: activeTab === "private" ? "#4dabf5" : "#aaaaaa"
          }}
        >
          Private {hasPrivateUnread && <span style={dotStyle} />}
        </button>
        <button 
          onClick={() => setActiveTab("group")}
          style={{
            ...tabStyle,
            borderBottom: activeTab === "group" ? "3px solid #007bff" : "3px solid transparent",
            color: activeTab === "group" ? "#4dabf5" : "#aaaaaa"
          }}
        >
          Groups {hasGroupUnread && <span style={dotStyle} />}
        </button>
      </div>

      <div style={listScrollStyle}>
        {loading ? (
          <p style={infoStyle}>Loading...</p>
        ) : activeTab === "private" ? (
          <UserList 
            users={users} 
            onSelect={handleSelect} 
            selectedId={selectedTargetId} 
            notifications={realtimeNotifications}
          />
        ) : (
          <GroupList 
            groups={groups} 
            onSelect={handleSelect} 
            selectedId={selectedTargetId} 
            notifications={realtimeNotifications}
          />
        )}
      </div>
    </div>
  );
}

function UserList({ users, onSelect, selectedId, notifications }) {
  const unreadSenderIds = new Set(notifications.filter(m => !m.type && !m.group_id).map(m => m.sender_id));
  
  if (users.length === 0) return <p style={infoStyle}>No followers yet.</p>;

  return (
    <ul style={listStyle}>
      {users.map(user => (
        <li 
          key={user.id} 
          onClick={() => onSelect({ ...user, type: "private" })}
          style={{
            ...itemStyle,
            background: selectedId === user.id ? "#2c3e50" : "transparent"
          }}
        >
          <div style={avatarStyle}>
            {user.avatar ? <img src={mediaUrl(user.avatar)} style={imgStyle} alt="" /> : user.first_name?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={nameStyle}>{user.first_name} {user.last_name}</div>
            <div style={subStyle}>@{user.nickname || "user"}</div>
          </div>
          {unreadSenderIds.has(user.id) && <span style={badgeStyle}>New</span>}
        </li>
      ))}
    </ul>
  );
}

function GroupList({ groups, onSelect, selectedId, notifications }) {
  const unreadGroupIds = new Set(notifications.filter(m => !m.type && m.group_id).map(m => m.group_id));

  // Task 3: Fix Sidebar Group Visibility
  const visibleGroups = groups.filter(group => group.is_member);

  if (visibleGroups.length === 0) return <p style={infoStyle}>No groups joined.</p>;

  return (
    <ul style={listStyle}>
      {visibleGroups.map(group => (
        <li 
          key={group.id} 
          onClick={() => onSelect({ ...group, type: "group" })}
          style={{
            ...itemStyle,
            background: selectedId === group.id ? "#2c3e50" : "transparent"
          }}
        >
          <div style={{ ...avatarStyle, borderRadius: "8px", background: "#333" }}>G</div>
          <div style={{ flex: 1 }}>
            <div style={nameStyle}>{group.title}</div>
            <div style={subStyle}>{group.description?.substring(0, 30)}...</div>
          </div>
          {unreadGroupIds.has(group.id) && <span style={badgeStyle}>New</span>}
        </li>
      ))}
    </ul>
  );
}

const sidebarContainerStyle = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "#121212",
  borderRight: "1px solid #333",
};

const tabContainerStyle = {
  display: "flex",
  borderBottom: "1px solid #333",
};

const tabStyle = {
  flex: 1,
  padding: "1rem",
  border: "none",
  background: "none",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "0.9rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
};

const listScrollStyle = {
  flex: 1,
  overflowY: "auto",
};

const listStyle = { listStyle: "none", padding: 0, margin: 0 };

const itemStyle = {
  display: "flex",
  alignItems: "center",
  padding: "0.75rem 1rem",
  cursor: "pointer",
  borderBottom: "1px solid #333",
};

const avatarStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: "#333",
  marginRight: "0.75rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  overflow: "hidden",
};

const imgStyle = { width: "100%", height: "100%", objectFit: "cover" };

const nameStyle = { fontWeight: "600", fontSize: "0.95rem", color: "white" };
const subStyle = { fontSize: "0.8rem", color: "#aaaaaa" };
const infoStyle = { padding: "1rem", color: "#aaaaaa", textAlign: "center" };

const dotStyle = { width: "8px", height: "8px", background: "#007bff", borderRadius: "50%" };

const badgeStyle = {
  background: "#ff4d4f",
  color: "white",
  fontSize: "10px",
  padding: "2px 6px",
  borderRadius: "10px",
  fontWeight: "bold",
};
