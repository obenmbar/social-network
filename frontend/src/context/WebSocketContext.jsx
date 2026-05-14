"use client";

import React, { createContext, useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { hasSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/api";

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [realtimeNotifications, setRealtimeNotifications] = useState([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); 
  const [me, setMe] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  const meRef = useRef(null);
  const activeChatRef = useRef(null);

  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (hasSession()) {
      getCurrentUser().then(setMe).catch(console.error);
    }
  }, [pathname]);

  const markAsRead = useCallback((targetId) => {
    setRealtimeNotifications((prev) => {
      const updated = prev.filter(n => 
        n.sender_id !== targetId && n.group_id !== targetId && n.source_id !== targetId
      );
      
      const remainingChatNotifs = updated.filter(n => !n.type);
      if (remainingChatNotifs.length === 0) {
        setHasNewMessage(false);
      }
      
      setUnreadCount(updated.length);
      return updated;
    });
  }, []);

  const connect = useCallback(() => {
    const isAuthPage = pathname === "/login" || pathname === "/register";
    if (!hasSession() || isAuthPage) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8080/ws`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const newMsg = JSON.parse(event.data);
        const currentMe = meRef.current;
        const currentActiveChat = activeChatRef.current;

        if (newMsg.type) {
          if (currentMe && newMsg.sender_id === currentMe.id) return;

          setRealtimeNotifications((prev) => {
            if (prev.some((n) => n.id === newMsg.id)) return prev;
            const next = [newMsg, ...prev];
            setUnreadCount(next.length);
            return next;
          });
        } else {
          setRealtimeMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          const isMe = currentMe && newMsg.sender_id === currentMe.id;
          const isViewing = currentActiveChat && (newMsg.group_id === currentActiveChat.id || newMsg.sender_id === currentActiveChat.id);

          if (!isMe && !isViewing) {
            setHasNewMessage(true);
            setRealtimeNotifications((prev) => {
              if (prev.some((n) => n.id === newMsg.id)) return prev;
              const next = [newMsg, ...prev];
              setUnreadCount(next.length);
              return next;
            });
          }
        }
      } catch (err) {
        console.error("WS error:", err);
      }
    };

    ws.onclose = () => {
      socketRef.current = null;
      if (hasSession() && pathname !== "/login" && pathname !== "/register") {
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    };
  }, [pathname]);

  const sendMessage = useCallback((message) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const value = {
    realtimeMessages,
    realtimeNotifications,
    hasNewMessage,
    unreadCount,
    activeChat,
    setActiveChat,
    sendMessage,
    markAsRead,
    me,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
