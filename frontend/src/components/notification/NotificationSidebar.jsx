"use client";

import React, { useEffect, useState } from "react";
import { getNotifications, isUnauthorized, markNotificationRead, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function NotificationSidebar() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { realtimeNotifications, setRealtimeNotifications } = useWebSocket();

  useEffect(() => {
    getNotifications()
      .then(setNotifications)
      .catch((err) => {
        if (!isUnauthorized(err)) {
          console.error("Failed to load notifications:", err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // Also remove from realtime state if it's there
      setRealtimeNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      if (!isUnauthorized(err)) {
        console.error("Failed to mark notification as read:", err);
      }
    }
  };

  // Combine fetched notifications with realtime ones, avoiding duplicates
  const allNotifications = [...realtimeNotifications, ...notifications].reduce((acc, current) => {
    const x = acc.find((item) => item.id === current.id);
    if (!x) {
      return acc.concat([current]);
    } else {
      return acc;
    }
  }, []);

  return (
    <aside style={sidebarStyle}>
      <h3 style={headerStyle}>Notifications</h3>
      
      {loading ? (
        <div style={infoContainerStyle}>
          <div style={spinnerStyle}></div>
          <p style={{ marginTop: "10px" }}>Loading...</p>
        </div>
      ) : allNotifications.length === 0 ? (
        <div style={infoContainerStyle}>
          <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔔</span>
          <p style={{ fontWeight: "500" }}>Your inbox is clear</p>
          <p style={{ fontSize: "0.8rem", color: "#999" }}>No new notifications.</p>
        </div>
      ) : (
        <ul style={listStyle}>
          {allNotifications.map((notif) => (
            <li key={notif.id} style={itemStyle}>
              <div style={{ flex: 1 }}>
                <p style={textStyle}>{notif.content || notif.message || notif.type}</p>
                <small style={timeStyle}>{new Date(notif.created_at).toLocaleString()}</small>
              </div>
              <button
                onClick={() => handleMarkRead(notif.id)}
                style={readButtonStyle}
              >
                Mark Read
              </button>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </aside>
  );
}

const sidebarStyle = {
  position: "fixed",
  right: 0,
  top: "60px",
  width: "300px",
  height: "calc(100vh - 60px)",
  background: "white",
  borderLeft: "1px solid #eee",
  boxShadow: "-2px 0 5px rgba(0,0,0,0.05)",
  zIndex: 1000,
  overflowY: "auto",
};

const headerStyle = {
  padding: "1rem",
  margin: 0,
  borderBottom: "1px solid #eee",
  fontSize: "1.2rem",
};

const listStyle = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const itemStyle = {
  padding: "1rem",
  borderBottom: "1px solid #f9f9f9",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const textStyle = {
  margin: 0,
  fontSize: "0.9rem",
};

const timeStyle = {
  color: "#888",
  fontSize: "0.8rem",
};

const readButtonStyle = {
  alignSelf: "flex-end",
  background: "none",
  border: "1px solid #eee",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "0.8rem",
  cursor: "pointer",
  color: "#666",
};

const infoContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "3rem 1rem",
  textAlign: "center",
  color: "#888",
};

const spinnerStyle = {
  width: "24px",
  height: "24px",
  border: "2px solid #f3f3f3",
  borderTop: "2px solid #007bff",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};
