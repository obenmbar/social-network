"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  getNotifications, 
  markNotificationRead, 
  getGroupInvitations,
  respondToGroupInvitation,
  acceptFollowRequest,
  declineFollowRequest
} from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { realtimeNotifications, setRealtimeNotifications } = useWebSocket();

  const fetchData = useCallback(async () => {
    try {
      const [notifs, invites] = await Promise.all([
        getNotifications(),
        getGroupInvitations()
      ]);
      setNotifications(notifs || []);
      setInvitations(invites || []);
    } catch (err) {
      console.error("Failed to load notifications data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setRealtimeNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleAction = async (notification, action) => {
    const { id, type, source_id } = notification;

    try {
      if (type === "follow_request") {
        if (action === "accept") {
          await acceptFollowRequest(source_id);
          // Optional: Trigger a broadcast or just rely on the next visit to /chat to see the user
        } else {
          await declineFollowRequest(source_id);
        }
      } else if (type === "group_invite") {
        // Find matching invitation to get groupID
        const invite = invitations.find(i => notification.content.includes(i.group.title));
        if (invite) {
          await respondToGroupInvitation(invite.group_id, action === "accept" ? "accepted" : "declined");
          setInvitations(prev => prev.filter(i => i.id !== invite.id));
        }
      }

      await handleMarkRead(id);
    } catch (err) {
      console.error(`Failed to ${action} ${type}:`, err);
      alert(`Error: ${err.message}`);
    }
  };

  const allNotifications = [...realtimeNotifications, ...notifications].reduce((acc, current) => {
    if (!acc.find(item => item.id === current.id)) {
      return acc.concat([current]);
    }
    return acc;
  }, []);

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1>Notifications</h1>
      </header>

      {loading ? (
        <p style={infoStyle}>Loading notifications...</p>
      ) : allNotifications.length === 0 ? (
        <div style={emptyStyle}>
          <span style={{ fontSize: "3rem" }}>📭</span>
          <p>You're all caught up!</p>
        </div>
      ) : (
        <ul style={listStyle}>
          {allNotifications.map((notif) => (
            <li key={notif.id} style={{
              ...itemStyle,
              background: notif.is_read ? "transparent" : "rgba(255, 255, 255, 0.05)"
            }}>
              <div style={iconStyle}>{getIcon(notif.type)}</div>
              <div style={{ flex: 1 }}>
                <p style={textStyle}>{notif.content || `New ${notif.type} notification`}</p>
                <small style={timeStyle}>{new Date(notif.created_at).toLocaleString()}</small>
                
                {/* Action Row for Requests/Invites */}
                {!notif.is_read && (notif.type === "follow_request" || notif.type === "group_invite") && (
                  <div style={actionRowStyle}>
                    <button 
                      onClick={() => handleAction(notif, "accept")} 
                      style={acceptButtonStyle}
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => handleAction(notif, "decline")} 
                      style={declineButtonStyle}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
              {!notif.is_read && notif.type !== "follow_request" && notif.type !== "group_invite" && (
                <button onClick={() => handleMarkRead(notif.id)} style={readButtonStyle}>
                  Mark Read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getIcon(type) {
  switch (type) {
    case "follow":
    case "follow_accept": return "👤";
    case "follow_request": return "📩";
    case "group_invite": return "👥";
    case "group_request":
    case "group_request_response": return "📩";
    case "event": return "📅";
    default: return "🔔";
  }
}

const containerStyle = { maxWidth: "800px", margin: "2rem auto", padding: "0 1rem" };
const headerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", color: "var(--text-main, #ffffff)" };
const listStyle = { listStyle: "none", padding: 0, margin: 0, background: "var(--bg-sidebar, #1e1e1e)", borderRadius: "8px", border: "1px solid var(--border-color, #333)", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.5)" };
const itemStyle = { padding: "1.25rem", borderBottom: "1px solid var(--border-color, #333)", display: "flex", alignItems: "center", gap: "1rem", color: "var(--text-main, #ffffff)" };
const iconStyle = { fontSize: "1.5rem" };
const textStyle = { margin: 0, fontWeight: "500", color: "var(--text-main, #ffffff)" };
const timeStyle = { color: "var(--text-secondary, #aaaaaa)", fontSize: "0.8rem" };
const actionRowStyle = { display: "flex", gap: "10px", marginTop: "10px" };
const acceptButtonStyle = { background: "#28a745", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" };
const declineButtonStyle = { background: "#dc3545", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" };
const readButtonStyle = { background: "#2a2a2a", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" };
const infoStyle = { textAlign: "center", padding: "2rem", color: "var(--text-secondary, #aaaaaa)" };
const emptyStyle = { textAlign: "center", padding: "4rem 2rem", background: "var(--bg-sidebar, #1e1e1e)", borderRadius: "8px", border: "1px solid var(--border-color, #333)", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.5)", color: "var(--text-main, #ffffff)" };
