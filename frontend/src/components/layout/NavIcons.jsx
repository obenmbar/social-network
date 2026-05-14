"use client";

import React from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function NavIcons() {
  const { hasNewMessage, hasUnreadNotifications } = useWebSocket();

  // hasUnreadNotifications represents generic social notifications (follow requests, group invites, etc.)
  // hasNewMessage represents chat specifically.

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      {/* Chat Link 💬 */}
      <Link 
        href="/chat" 
        style={containerStyle} 
        title="Messages"
      >
        <span style={{ fontSize: "24px" }}>💬</span>
        {hasNewMessage && (
          <div style={dotStyle} />
        )}
      </Link>

      {/* Notification Link 🔔 */}
      <Link 
        href="/notifications" 
        style={containerStyle} 
        title="Notifications"
      >
        <span style={{ fontSize: "24px" }}>🔔</span>
        {hasUnreadNotifications && (
          <span style={{ position: 'absolute', top: 0, right: 0, width: '8px', height: '8px', backgroundColor: 'red', borderRadius: '50%' }}></span>
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

const dotStyle = {
  position: "absolute",
  top: "0px",
  right: "0px",
  background: "#ff4d4f",
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  border: "2px solid white",
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
