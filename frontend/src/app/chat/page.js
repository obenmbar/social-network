"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SidebarManager from "@/components/chat/SidebarManager";
import ChatWindow from "@/components/chat/ChatWindow";
import { getCurrentUser } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function ChatPage() {
  const { activeChat, setActiveChat } = useWebSocket();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    getCurrentUser()
      .then(() => {
        setIsAuthenticated(true);
        setLoading(false);
      })
      .catch(() => {
        router.replace("/login");
      });

    return () => setActiveChat(null);
  }, [router, setActiveChat]);

  if (!mounted) return null;

  if (loading) {
    return <div style={emptyStateStyle}>Loading chat...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={pageContainerStyle}>
      <div style={sidebarWrapperStyle}>
        <SidebarManager 
          onSelectTarget={setActiveChat} 
          selectedTargetId={activeChat?.id} 
        />
      </div>
      
      <main style={mainContentStyle}>
        {activeChat ? (
          <ChatWindow 
            selectedUser={activeChat} 
            isFullPage={true} 
          />
        ) : (
          <div style={emptyStateStyle}>
            <span style={{ fontSize: "3rem", marginBottom: "1rem" }}>💬</span>
            <h2>Select a conversation to start chatting</h2>
            <p style={{ color: "var(--muted-foreground)" }}>Pick a friend or group from the list on the left.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const pageContainerStyle = {
  display: "flex",
  height: "calc(100vh - 64px)",
  background: "var(--background)",
  color: "var(--foreground)",
  overflow: "hidden",
};

const sidebarWrapperStyle = {
  width: "300px",
  flexShrink: 0,
};

const mainContentStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  background: "var(--surface)",
};

const emptyStateStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};
