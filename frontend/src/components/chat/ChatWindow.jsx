"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { getChatHistory, getGroupChatHistory, getCurrentUser, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import MessageInput from "./MessageInput";

export default function ChatWindow({ selectedUser, onClose, isFullPage = false }) {
  const [history, setHistory] = useState([]);
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const { realtimeMessages } = useWebSocket();
  const messagesEndRef = useRef(null);
  
  // Determine if it's a private chat or a group chat
  const isGroup = selectedUser?.type === "group";
  const targetId = selectedUser?.id;

  useEffect(() => {
    getCurrentUser().then(setMe).catch(console.error);
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Reset States immediately to prevent race conditions when switching targets
    setHistory([]);
    setOptimisticMessages([]);
    setAccessDenied(false);

    if (!targetId || !selectedUser) {
      return;
    }

    setLoading(true);
    
    const fetchPromise = isGroup 
      ? getGroupChatHistory(targetId) 
      : getChatHistory(targetId);
    
    fetchPromise
      .then((data) => {
        if (!isMounted) return;
        setHistory(data || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err.status === 403) {
          setAccessDenied(true);
          setHistory([]);
        } else {
          console.error("Failed to load chat history:", err);
          setHistory([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      // Cleanup function to cancel state updates from stale requests
      isMounted = false;
    };
  }, [targetId, isGroup, selectedUser]);

  const filteredRealtime = useMemo(() => {
    if (!me || !targetId) return [];
    return realtimeMessages.filter((msg) => {
      if (isGroup) {
        return msg.group_id === targetId;
      } else {
        const isFromMeToThem = msg.sender_id === me.id && msg.receiver_id === targetId;
        const isFromThemToMe = msg.sender_id === targetId && msg.receiver_id === me.id;
        return isFromMeToThem || isFromThemToMe;
      }
    });
  }, [realtimeMessages, me, targetId, isGroup]);

  const filteredOptimistic = useMemo(() => {
    return optimisticMessages.filter(msg => {
      if (isGroup) return msg.group_id === targetId;
      return msg.receiver_id === targetId;
    });
  }, [optimisticMessages, targetId, isGroup]);

  // Combine history, realtime, and optimistic messages, deduplicating by ID
  const allMessages = useMemo(() => {
    const combined = [...history, ...filteredRealtime, ...filteredOptimistic];
    const unique = [];
    const seen = new Set();
    
    for (const msg of combined) {
      if (msg && !seen.has(msg.id)) {
        unique.push(msg);
        seen.add(msg.id);
      }
    }
    
    return unique.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [history, filteredRealtime, filteredOptimistic]);

  const handleSendMessage = useCallback((messageData) => {
    const tempId = `temp-${Date.now()}`;
    const newMessage = {
      id: tempId,
      sender_id: me?.id,
      sender_name: me ? `${me.first_name} ${me.last_name}` : "Me",
      content: messageData.content,
      created_at: new Date().toISOString(),
      ...messageData,
    };
    setOptimisticMessages((prev) => [...prev, newMessage]);
  }, [me]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, loading]);

  if (!selectedUser) return null;

  const displayName = isGroup ? selectedUser.title : `${selectedUser.first_name} ${selectedUser.last_name}`;
  const displaySubtitle = isGroup ? "Group Chat" : `@${selectedUser.nickname || "user"}`;
  const myAvatarSrc = me?.avatar ? mediaUrl(me.avatar) : null;
  const theirAvatarSrc = selectedUser.avatar ? mediaUrl(selectedUser.avatar) : null;

  const activeWindowStyle = isFullPage 
    ? { ...windowStyle, position: "static", width: "100%", height: "100%", boxShadow: "none", border: "none" } 
    : windowStyle;

  return (
    <div style={activeWindowStyle}>
      <header style={headerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={headerAvatarStyle}>
              {isGroup ? (
                <span style={{ fontSize: "1.2rem" }}>👥</span>
              ) : theirAvatarSrc ? (
                <img src={theirAvatarSrc} style={imgStyle} alt="" />
              ) : (
                <span style={{ fontSize: "1.2rem" }}>{selectedUser.first_name?.[0] || "?"}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: "1rem", color: "#333" }}>{displayName}</strong>
              <span style={subtitleStyle}>{displaySubtitle}</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={closeButtonStyle} aria-label="Close Chat">&times;</button>
          )}
        </div>
      </header>

      <div style={messageListStyle}>
        {loading ? (
          <div style={loadingContainerStyle}>
            <div style={spinnerStyle}></div>
            <p style={{ marginTop: "10px", color: "#888" }}>Loading conversation...</p>
          </div>
        ) : accessDenied ? (
          <div style={emptyChatStyle}>
            <span style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🚫</span>
            <p style={{ fontWeight: "500" }}>You are not a member of this group</p>
            <p style={{ fontSize: "0.85rem", color: "#999" }}>Join the group to view messages.</p>
          </div>
        ) : allMessages.length === 0 ? (
          <div style={emptyChatStyle}>
            <span style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>💬</span>
            <p style={{ fontWeight: "500" }}>No messages here yet</p>
            <p style={{ fontSize: "0.85rem", color: "#999" }}>Say hello to start the conversation!</p>
          </div>
        ) : (
          allMessages.map((msg) => {
            if (!msg) return null;
            const isMe = me && msg.sender_id === me.id;
            
            // Avatar logic
            const avatarSrc = isMe ? myAvatarSrc : (isGroup ? null : theirAvatarSrc);
            const initial = isMe ? (me?.first_name?.[0] || "M") : (msg.sender_name?.[0] || "U");

            return (
              <div
                key={msg.id}
                style={{
                  ...messageRowStyle,
                  flexDirection: isMe ? "row-reverse" : "row",
                }}
              >
                {/* Avatar */}
                <div style={avatarContainerStyle}>
                  {avatarSrc ? (
                    <img src={avatarSrc} style={bubbleAvatarStyle} alt="" />
                  ) : (
                    <div style={avatarPlaceholderStyle}>{initial}</div>
                  )}
                </div>

                {/* Message Bubble */}
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: isMe ? "flex-end" : "flex-start",
                  maxWidth: "70%",
                }}>
                  {!isMe && isGroup && (
                    <div style={senderNameStyle}>{msg.sender_name}</div>
                  )}
                  
                  <div
                    style={{
                      ...bubbleStyle,
                      background: isMe ? "#007bff" : "#f1f0f0",
                      color: isMe ? "white" : "black",
                      borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    }}
                  >
                    <div style={{ fontSize: "0.95rem" }}>{msg.content}</div>
                    <div style={{
                      ...timeStyle,
                      color: isMe ? "rgba(255,255,255,0.7)" : "#888",
                    }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {!accessDenied && (
        <MessageInput 
          target={selectedUser} 
          onSendMessage={handleSendMessage}
        />
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const windowStyle = {
  position: "fixed",
  right: "305px", 
  bottom: "20px",
  width: "400px",
  height: "600px",
  background: "white",
  border: "1px solid #e0e0e0",
  borderRadius: "16px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
  display: "flex",
  flexDirection: "column",
  zIndex: 1001,
  overflow: "hidden",
};

const headerStyle = {
  padding: "1rem 1.25rem",
  background: "white",
  borderBottom: "1px solid #f0f0f0",
  display: "flex",
};

const headerAvatarStyle = {
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  background: "#f5f7f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  overflow: "hidden",
};

const imgStyle = { width: "100%", height: "100%", objectFit: "cover" };

const subtitleStyle = { fontSize: "0.75rem", color: "#999" };

const closeButtonStyle = { 
  background: "none", 
  border: "none", 
  fontSize: "1.8rem", 
  cursor: "pointer", 
  color: "#ddd",
  padding: "0 4px",
  lineHeight: "1",
};

const messageListStyle = {
  flex: 1,
  padding: "1.5rem 1rem",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "1.2rem",
  background: "#fff",
};

const messageRowStyle = { 
  display: "flex", 
  width: "100%", 
  gap: "10px",
};

const avatarContainerStyle = {
  width: "32px",
  height: "32px",
  flexShrink: 0,
  alignSelf: "flex-end",
};

const bubbleAvatarStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
};

const avatarPlaceholderStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: "#e0e0e0",
  color: "#888",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.85rem",
  fontWeight: "600",
};

const bubbleStyle = {
  padding: "0.8rem 1rem",
  position: "relative",
  wordBreak: "break-word",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
};

const senderNameStyle = { 
  fontWeight: "600", 
  fontSize: "0.75rem", 
  marginBottom: "4px", 
  color: "#555",
  marginLeft: "4px",
};

const timeStyle = {
  fontSize: "0.65rem",
  marginTop: "4px",
  textAlign: "right",
};

const emptyChatStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#ccc",
  textAlign: "center",
};

const loadingContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
};

const spinnerStyle = {
  width: "30px",
  height: "30px",
  border: "3px solid #f3f3f3",
  borderTop: "3px solid #007bff",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};
