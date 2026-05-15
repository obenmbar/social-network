"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import Link from "next/link";
import { getChatHistory, getGroupChatHistory, getCurrentUser, mediaUrl } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import MessageInput from "./MessageInput";
import styles from "./ChatWindow.module.css";

const DEFAULT_AVATAR = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

export default function ChatWindow({ selectedUser, onClose, isFullPage = false }) {
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const { realtimeMessages } = useWebSocket();
  
  const chatContainerRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const isAnchoringRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  
  const isGroup = selectedUser?.type === "group";
  const targetId = selectedUser?.id;

  useEffect(() => {
    getCurrentUser().then(setMe).catch(console.error);
  }, []);

  const loadHistory = useCallback(async (cursor = "") => {
    if (!targetId || !selectedUser) return;

    if (!cursor) {
      setLoading(true);
    }

    try {
      const fetchPromise = isGroup 
        ? getGroupChatHistory(targetId, cursor) 
        : getChatHistory(targetId, cursor);
      
      const data = await fetchPromise;
      const newOlderMessages = data || [];

      setHasMoreMessages(newOlderMessages.length >= 10);

      if (cursor) {
        if (chatContainerRef.current) {
          previousScrollHeightRef.current = chatContainerRef.current.scrollHeight;
          isAnchoringRef.current = true;
        }

        setMessages(prev => {
          const combined = [...newOlderMessages, ...prev];
          return combined.filter((msg, idx, self) => 
            idx === self.findIndex(m => m.id === msg.id)
          );
        });
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

  useEffect(() => {
    setMessages([]);
    setAccessDenied(false);
    setHasMoreMessages(true);
    isInitialLoadRef.current = true;
    loadHistory("");
  }, [targetId, isGroup, loadHistory]);

  const handleLoadMore = () => {
    if (messages && messages.length > 0 && !loading) {
      const oldestId = messages[0]?.id;
      loadHistory(oldestId);
    }
  };

  useLayoutEffect(() => {
    if (!chatContainerRef.current) return;

    if (isAnchoringRef.current) {
      const newHeight = chatContainerRef.current.scrollHeight;
      chatContainerRef.current.scrollTop = newHeight - previousScrollHeightRef.current;
      isAnchoringRef.current = false;
    } else if (isInitialLoadRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      isInitialLoadRef.current = false;
    } else if (messages.length > 0) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      if (scrollHeight - scrollTop - clientHeight < 150) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
  }, [messages]);

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
  const myAvatarSrc = me?.avatar ? mediaUrl(me.avatar) : DEFAULT_AVATAR;
  const theirAvatarSrc = selectedUser.avatar ? mediaUrl(selectedUser.avatar) : DEFAULT_AVATAR;

  return (
    <div className={`${styles.window} ${isFullPage ? styles.windowFullPage : ""}`}>
      <header className={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className={styles.headerAvatar}>
              {isGroup ? (
                <span style={{ fontSize: "1.2rem" }}>👥</span>
              ) : (
                <img src={theirAvatarSrc} className={styles.avatarImg} alt="" />
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
                const senderAvatar = isMe ? myAvatarSrc : (msg.sender_avatar ? mediaUrl(msg.sender_avatar) : DEFAULT_AVATAR);

                return (
                  <div
                    key={msg.id}
                    className={styles.messageRow}
                    style={{ flexDirection: isMe ? "row-reverse" : "row" }}
                  >
                    <div className={styles.avatarContainer}>
                      <Link href={`/profile/${msg.sender_id}`}>
                        <img src={senderAvatar} className={styles.bubbleAvatar} alt="" />
                      </Link>
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
