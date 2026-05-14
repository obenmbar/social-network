"use client";

import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { getChatHistory, getGroupChatHistory, getCurrentUser, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import MessageInput from "./MessageInput";
import styles from "./ChatWindow.module.css";

export default function ChatWindow({ selectedUser, onClose, isFullPage = false }) {
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const { realtimeMessages } = useWebSocket();
  
  const chatContainerRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  
  const isGroup = selectedUser?.type === "group";
  const targetId = selectedUser?.id;

  useEffect(() => {
    getCurrentUser().then(setMe).catch(console.error);
  }, []);

  const loadHistory = useCallback(async (cursor = "") => {
    if (!targetId || !selectedUser) return;

    if (cursor) {
      setIsFetchingHistory(true);
    } else {
      setLoading(true);
    }

    try {
      const fetchPromise = isGroup 
        ? getGroupChatHistory(targetId, cursor) 
        : getChatHistory(targetId, cursor);
      
      const data = await fetchPromise;
      const newOlderMessages = data || [];

      // Step 3: Hide Button Condition
      if (newOlderMessages.length < 10) {
        setHasMoreMessages(false);
      } else {
        setHasMoreMessages(true);
      }

      if (cursor) {
        // Step 2: Scroll Position Retention (CRITICAL)
        // Capture BEFORE updating the state
        if (chatContainerRef.current) {
          previousScrollHeightRef.current = chatContainerRef.current.scrollHeight;
        }

        // Prepend and strictly remove duplicates by ID
        setMessages(prev => [...newOlderMessages, ...prev].filter((msg, idx, self) => 
          idx === self.findIndex(m => m.id === msg.id)
        ));
      } else {
        setMessages(newOlderMessages);
      }
    } catch (err) {
      if (err.status === 403) {
        setAccessDenied(true);
      } else {
        console.error("Failed to load chat history:", err);
      }
      if (!cursor) setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [targetId, isGroup, selectedUser]);

  // Initial load on target change
  useEffect(() => {
    setMessages([]);
    setAccessDenied(false);
    setHasMoreMessages(true);
    setIsFetchingHistory(false);
    loadHistory("");
  }, [targetId, isGroup, loadHistory]);

  const handleLoadMore = () => {
    if (messages && messages.length > 0) {
      // Step 1: The Fetch Logic - Pass the ID of the OLDEST message
      const oldestId = messages[0]?.id;
      loadHistory(oldestId);
    }
  };

  // Step 2: Scroll Position Retention (CRITICAL)
  useLayoutEffect(() => {
    if (!chatContainerRef.current) return;

    if (isFetchingHistory) {
      // Adjust scroll position right after DOM updates
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight - previousScrollHeightRef.current;
      setIsFetchingHistory(false);
    } else {
      // Auto-scroll to bottom for initial load and new messages
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isFetchingHistory]);

  // Handle Realtime Messages
  useEffect(() => {
    if (!me || !targetId || realtimeMessages.length === 0) return;

    setMessages((prev) => {
      const matchingRealtime = realtimeMessages.filter((msg) => {
        const isForThisChat = isGroup 
          ? msg.group_id === targetId 
          : (msg.sender_id === me.id && msg.receiver_id === targetId) || 
            (msg.sender_id === targetId && msg.receiver_id === me.id);
        
        if (!isForThisChat) return false;
        return !prev.some(m => m.id === msg.id);
      });

      if (matchingRealtime.length === 0) return prev;

      const newMessages = [...prev, ...matchingRealtime];
      return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    });
  }, [realtimeMessages, me, targetId, isGroup]);

  if (!selectedUser) return null;

  const displayName = isGroup ? selectedUser.title : `${selectedUser.first_name} ${selectedUser.last_name}`;
  const displaySubtitle = isGroup ? "Group Chat" : `@${selectedUser.nickname || "user"}`;
  const myAvatarSrc = me?.avatar ? mediaUrl(me.avatar) : null;
  const theirAvatarSrc = selectedUser.avatar ? mediaUrl(selectedUser.avatar) : null;

  return (
    <div className={`${styles.window} ${isFullPage ? styles.windowFullPage : ""}`}>
      <header className={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className={styles.headerAvatar}>
              {isGroup ? (
                <span style={{ fontSize: "1.2rem" }}>👥</span>
              ) : theirAvatarSrc ? (
                <img src={theirAvatarSrc} className={styles.avatarImg} alt="" />
              ) : (
                <span style={{ fontSize: "1.2rem" }}>{selectedUser.first_name?.[0] || "?"}</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <strong style={{ fontSize: "1rem", color: "#ffffff" }}>{displayName}</strong>
              <span className={styles.subtitle}>{displaySubtitle}</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className={styles.closeButton} aria-label="Close Chat">&times;</button>
          )}
        </div>
      </header>

      <div className={styles.messageList} ref={chatContainerRef}>
        {loading && messages.length === 0 ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p style={{ marginTop: "10px", color: "#aaaaaa" }}>Loading conversation...</p>
          </div>
        ) : accessDenied ? (
          <div className={styles.emptyChat}>
            <span style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🚫</span>
            <p style={{ fontWeight: "500" }}>You are not a member of this group</p>
            <p style={{ fontSize: "0.85rem", color: "#aaaaaa" }}>Join the group to view messages.</p>
          </div>
        ) : (
          <>
            {hasMoreMessages && messages?.length >= 10 && (
              <button 
                onClick={handleLoadMore} 
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "var(--bg-selected, #2c3e50)",
                  color: "var(--text-main, #ffffff)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginBottom: "15px",
                  fontSize: "0.9rem",
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? "Loading..." : "Load older messages"}
              </button>
            )}

            {messages.length === 0 && !loading ? (
              <div className={styles.emptyChat}>
                <span style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>💬</span>
                <p style={{ fontWeight: "500" }}>No messages here yet</p>
                <p style={{ fontSize: "0.85rem", color: "#aaaaaa" }}>Say hello to start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                if (!msg) return null;
                const isMe = me && msg.sender_id === me.id;
                const avatarSrc = isMe ? myAvatarSrc : (isGroup ? null : theirAvatarSrc);
                const initial = isMe ? (me?.first_name?.[0] || "M") : (msg.sender_name?.[0] || "U");

                return (
                  <div
                    key={msg.id}
                    className={styles.messageRow}
                    style={{ flexDirection: isMe ? "row-reverse" : "row" }}
                  >
                    <div className={styles.avatarContainer}>
                      {avatarSrc ? (
                        <img src={avatarSrc} className={styles.bubbleAvatar} alt="" />
                      ) : (
                        <div className={styles.avatarPlaceholder}>{initial}</div>
                      )}
                    </div>

                    <div className={styles.messageBubbleContainer} style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {!isMe && isGroup && (
                        <div className={styles.senderName}>{msg.sender_name}</div>
                      )}
                      
                      <div
                        className={styles.bubble}
                        style={{
                          background: isMe ? "#007bff" : "#2a2a2a",
                          color: "#ffffff",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        }}
                      >
                        <div style={{ fontSize: "0.95rem" }}>{msg.content}</div>
                        <div className={styles.time} style={{ color: isMe ? "rgba(255,255,255,0.7)" : "#aaaaaa" }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {!accessDenied && (
        <MessageInput 
          target={selectedUser} 
          onSendMessage={() => {}}
        />
      )}
    </div>
  );
}
