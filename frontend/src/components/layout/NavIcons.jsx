"use client";

import React from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function NavIcons() {
  const { realtimeMessages, realtimeNotifications } = useWebSocket();

  const msgCount = realtimeMessages.length;
  const notifCount = realtimeNotifications.length;

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      {/* Chat Link 💬 */}
      <Link 
        href="/chat" 
        style={containerStyle} 
        title="Messages"
      >
        <span style={{ fontSize: "24px" }}>💬</span>
        {msgCount > 0 && (
          <span style={badgeStyle}>{msgCount}</span>
        )}
      </Link>

      {/* Notification Link 🔔 */}
      <Link 
        href="/notifications" 
        style={containerStyle} 
        title="Notifications"
      >
        <span style={{ fontSize: "24px" }}>🔔</span>
        {notifCount > 0 && (
          <span style={badgeStyle}>{notifCount}</span>
        )}
      </Link>
    </div>
  );
}

const containerStyle = {
  position: "relative",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  color: "inherit",
};

const badgeStyle = {
  position: "absolute",
  top: "-5px",
  right: "-5px",
  background: "red",
  color: "white",
  borderRadius: "50%",
  width: "18px",
  height: "18px",
  fontSize: "11px",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 0 0 2px white",
};
