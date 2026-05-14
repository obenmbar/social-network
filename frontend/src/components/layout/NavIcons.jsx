"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function NavIcons() {
  const { hasNewMessage, hasUnreadNotifications } = useWebSocket();
  const [showRedDot, setShowRedDot] = useState(hasUnreadNotifications);

  useEffect(() => {
    // Sync with context initially and whenever context state changes
    setShowRedDot(hasUnreadNotifications);

    const handleNewNotification = () => {
      setShowRedDot(true);
    };

    window.addEventListener('new_social_notification', handleNewNotification);

    return () => {
      window.removeEventListener('new_social_notification', handleNewNotification);
    };
  }, [hasUnreadNotifications]);

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
        {showRedDot && (
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
