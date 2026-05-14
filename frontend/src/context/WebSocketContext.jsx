"use client";

import React, { createContext, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { hasSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/api";

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [realtimeNotifications, setRealtimeNotifications] = useState([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);
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

  // Social notifications filtering
  const socialNotifications = useMemo(() => {
    return realtimeNotifications.filter(n => 
      n.type === "follow_request" || 
      n.type === "group_invite" || 
      n.type === "group_request"
    );
  }, [realtimeNotifications]);

  const socialUnreadCount = socialNotifications.length;

  const removeSocialNotification = useCallback((id) => {
    setRealtimeNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAsRead = useCallback((targetId) => {
    setRealtimeNotifications((prev) => {
      const updated = prev.filter(n => 
        n.sender_id !== targetId && n.group_id !== targetId && n.source_id !== targetId
      );
      
      const remainingChatNotifs = updated.filter(n => !n.type);
      if (remainingChatNotifs.length === 0) {
        setHasNewMessage(false);
      }
      
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
    console.log("Connecting to WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("🟢 WS Connected");
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
          // General and Social Notification logic
          if (currentMe && newMsg.sender_id === currentMe.id) return;

          setRealtimeNotifications((prev) => {
            if (prev.some((n) => n.id === newMsg.id)) return prev;
            return [newMsg, ...prev];
          });
        } else {
          // Chat Message logic
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
              return [newMsg, ...prev];
            });
          }
        }
      } catch (err) {
        console.error("WS error parsing message:", err);
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

    ws.onerror = (err) => console.error("WS error:", err);
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
    socialNotifications,
    socialUnreadCount,
    hasNewMessage,
    activeChat,
    setActiveChat,
    sendMessage,
    markAsRead,
    removeSocialNotification,
    me,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
