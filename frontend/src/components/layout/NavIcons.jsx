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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
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
