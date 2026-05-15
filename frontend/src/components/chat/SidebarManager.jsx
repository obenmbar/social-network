"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from "react";
import { getChatContacts, getFollowers, getFollowing, getGroups, isUnauthorized, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function SidebarManager({ onSelectTarget, selectedTargetId }) {
  const [activeTab, setActiveTab] = useState("private"); // 'private' or 'group'
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unreadChatIds, lastActivityMap, setLastActivityMap, markAsRead, setActiveChat } = useWebSocket();

  useEffect(() => {
    setLoading(true);
    const fetchData = activeTab === "private" ? getPrivateContacts() : getGroups();
    
    fetchData
      .then((data) => {
        if (data && data.length > 0) {
          const updates = {};
          data.forEach(item => {
            if (item.last_activity) {
              updates[`${activeTab}_${item.id}`] = new Date(item.last_activity).getTime();
            }
          });
          if (Object.keys(updates).length > 0) {
            setLastActivityMap(prev => ({ ...prev, ...updates }));
          }
        }
        if (activeTab === "private") setUsers(data || []);
        else setGroups(data || []);
      })
      .catch((err) => {
        if (!isUnauthorized(err)) {
          console.error(`Failed to load ${activeTab}:`, err);
        }
      })
      .finally(() => setLoading(false));
  }, [activeTab, setLastActivityMap]);

  // Determine which tabs have unread messages using prefixed unreadChatIds
  const hasPrivateUnread = unreadChatIds.some(id => id.startsWith('private_'));
  const hasGroupUnread = unreadChatIds.some(id => id.startsWith('group_'));

  const handleSelect = (target) => {
    const type = target.type || (target.group_id ? 'group' : 'private');
    const normalizedTarget = { ...target, type };
    markAsRead(normalizedTarget.id, type);
    setActiveChat(normalizedTarget);
    onSelectTarget(normalizedTarget);
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

  // Dynamic sorting for groups
  const visibleGroups = groups.filter(group => group.is_member);
  const sortedGroups = [...visibleGroups].sort((a, b) => {
    const lastA = lastActivityMap[`group_${a.id}`] || (a.last_activity ? new Date(a.last_activity).getTime() : 0);
    const lastB = lastActivityMap[`group_${b.id}`] || (b.last_activity ? new Date(b.last_activity).getTime() : 0);
    
    // Sort by last activity descending
    if (lastB !== lastA) return lastB - lastA;
    
    // Fallback to alphabetical
    return (a.title || "").localeCompare(b.title || "");
  });

  return (
    <div style={sidebarContainerStyle}>
      <div style={tabContainerStyle}>
        <button 
          onClick={() => setActiveTab("private")}
          style={{
            ...tabStyle,
            borderBottom: activeTab === "private" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "private" ? "var(--primary)" : "var(--muted-foreground)"
          }}
        >
          Private {hasPrivateUnread && <span className="tab-indicator" style={tabIndicatorStyle}></span>}
        </button>
        <button 
          onClick={() => setActiveTab("group")}
          style={{
            ...tabStyle,
            borderBottom: activeTab === "group" ? "3px solid var(--primary)" : "3px solid transparent",
            color: activeTab === "group" ? "var(--primary)" : "var(--muted-foreground)"
          }}
        >
          Groups {hasGroupUnread && <span className="tab-indicator" style={tabIndicatorStyle}></span>}
        </button>
      </div>

      <div style={listScrollStyle}>
        {loading ? (
          <p style={infoStyle}>Loading...</p>
        ) : activeTab === "private" ? (
          <UserList 
            users={sortedUsers} 
            onSelect={handleSelect} 
            selectedId={selectedTargetId} 
            unreadChatIds={unreadChatIds}
          />
        ) : (
          <GroupList 
            groups={sortedGroups} 
            onSelect={handleSelect} 
            selectedId={selectedTargetId} 
            unreadChatIds={unreadChatIds}
          />
        )}
      </div>
    </div>
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

function UserList({ users, onSelect, selectedId, unreadChatIds }) {
  if (users.length === 0) return <p style={infoStyle}>No conversations yet.</p>;

  return (
    <ul style={listStyle}>
      {users.map(user => {
        const isUnread = unreadChatIds.includes(`private_${user.id}`);
        return (
          <li 
            key={user.id} 
            onClick={() => onSelect({ ...user, type: "private" })}
            style={{
              ...itemStyle,
              background: selectedId === user.id ? "var(--bg-selected)" : "transparent"
            }}
          >
            <div style={avatarStyle}>
              {user.avatar ? <img src={mediaUrl(user.avatar)} style={imgStyle} alt="" /> : user.first_name?.[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={nameStyle}>{user.first_name} {user.last_name}</div>
              <div style={subStyle}>
                @{user.nickname || "user"}
                {user.can_message === false ? " · read only" : ""}
              </div>
            </div>
            {isUnread && <span style={newBadgeStyle}>New</span>}
          </li>
        );
      })}
    </ul>
  );
}

function GroupList({ groups, onSelect, selectedId, unreadChatIds }) {
  if (groups.length === 0) return <p style={infoStyle}>No groups joined.</p>;

  return (
    <ul style={listStyle}>
      {groups.map(group => {
        const isUnread = unreadChatIds.includes(`group_${group.id}`);
        return (
          <li 
            key={group.id} 
            onClick={() => onSelect({ ...group, type: "group" })}
            style={{
              ...itemStyle,
              background: selectedId === group.id ? "var(--bg-selected)" : "transparent"
            }}
          >
            <div style={{ ...avatarStyle, borderRadius: "8px" }}>G</div>
            <div style={{ flex: 1 }}>
              <div style={nameStyle}>{group.title}</div>
              <div style={subStyle}>{group.description?.substring(0, 30)}...</div>
            </div>
            {isUnread && <span style={newBadgeStyle}>New</span>}
          </li>
        );
      })}
    </ul>
  );
}

const sidebarContainerStyle = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "var(--background)",
  borderRight: "1px solid var(--border)",
};

const tabContainerStyle = {
  display: "flex",
  borderBottom: "1px solid var(--border)",
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
  borderBottom: "1px solid var(--border)",
  color: "var(--foreground)",
};

const avatarStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  background: "var(--border)",
  color: "var(--foreground)",
  marginRight: "0.75rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  overflow: "hidden",
};

const imgStyle = { width: "100%", height: "100%", objectFit: "cover" };

const nameStyle = { fontWeight: "600", fontSize: "0.95rem", color: "var(--foreground)" };
const subStyle = { fontSize: "0.8rem", color: "var(--muted-foreground)" };
const infoStyle = { padding: "1rem", color: "var(--muted-foreground)", textAlign: "center" };
const newBadgeStyle = { color: "var(--error)", fontSize: "12px", fontWeight: "bold" };
const tabIndicatorStyle = {
  width: "8px",
  height: "8px",
  backgroundColor: "var(--primary)",
  borderRadius: "50%",
  display: "inline-block",
  marginLeft: "5px",
};
