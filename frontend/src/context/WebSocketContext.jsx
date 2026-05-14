"use client";

import React, { createContext, useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { hasSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/api";

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [realtimeNotifications, setRealtimeNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [me, setMe] = useState(null);
  const [activeChat, setActiveChat] = useState(null); // Step 1: Track the currently open chat
  
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isFirstConnectionAfterLogin = useRef(true);
  const pathname = usePathname();
  
  const connectRef = useRef(null);

  useEffect(() => {
    if (hasSession()) {
      getCurrentUser().then(setMe).catch(console.error);
    }
  }, [pathname]);

  const markAsRead = useCallback((targetId) => {
    setRealtimeNotifications((prev) => {
      // Step 3: Fix Decrement Logic via markAsRead
      // Filter out notifications matching the opened chat/group
      const updatedNotifications = prev.filter(
        (notif) => {
          if (!notif.type) {
            return notif.sender_id !== targetId && notif.group_id !== targetId;
          }
          return notif.source_id !== targetId && notif.id !== targetId;
        }
      );
      
      // Strictly set the global counter to the length of the remaining notifications
      setUnreadCount(updatedNotifications.length);
      return updatedNotifications;
    });
  }, []);

  const connect = useCallback(() => {
    const isAuthPage = pathname === "/login" || pathname === "/register";
    
    if (!hasSession() || isAuthPage) {
      isFirstConnectionAfterLogin.current = true;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const establish = () => {
      if (!hasSession() || pathname === "/login" || pathname === "/register") return;
      
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = window.location.hostname;
      const wsUrl = `${wsProtocol}//${wsHost}:8080/ws`;
      console.log("Connecting to WebSocket:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("🟢 WS Connected successfully!");
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const newMsg = JSON.parse(event.data);
          console.log("📥 WS Message received:", newMsg);

          if (newMsg.type) {
            // Step 2: Fix Self-Increment - Do not notify for the user's own actions
            if (me && newMsg.sender_id === me.id) return;

            // It's a notification
            setRealtimeNotifications((prev) => {
              if (prev.some((n) => n.id === newMsg.id)) return prev;
              const next = [newMsg, ...prev];
              setUnreadCount(next.length);
              return next;
            });
          } else {
            // It's a chat message
            setRealtimeMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Step 2: Active Chat Guard
            if (me && newMsg.sender_id !== me.id) {
              const isGroup = !!newMsg.group_id;
              const isMatchingChat = isGroup 
                ? activeChat?.type === "group" && activeChat?.id === newMsg.group_id
                : activeChat?.type === "private" && activeChat?.id === newMsg.sender_id;

              if (!isMatchingChat) {
                // ONLY increment count and add to notifications if we are NOT actively viewing this chat
                setRealtimeNotifications((prev) => {
                  if (prev.some((n) => n.id === newMsg.id)) return prev;
                  const next = [newMsg, ...prev];
                  setUnreadCount(next.length);
                  return next;
                });
              }
            }
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onclose = (event) => {
        console.warn("🟠 WS Closed. Code:", event.code, "Reason:", event.reason);
        socketRef.current = null;

        if (event.code === 4001 || !hasSession()) {
          setRealtimeMessages([]);
          setRealtimeNotifications([]);
          setUnreadCount(0);
          isFirstConnectionAfterLogin.current = true;
          return;
        }

        if (hasSession() && pathname !== "/login" && pathname !== "/register") {
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connectRef.current?.();
            }, 3000);
          }
        }
      };

      ws.onerror = (err) => {
        console.error("🔴 WS Error occurred. Check backend logs for 401/403 or CORS.", err);
      };
    };

    if (isFirstConnectionAfterLogin.current) {
      isFirstConnectionAfterLogin.current = false;
      setTimeout(establish, 500);
    } else {
      establish();
    }
  }, [pathname, me, activeChat]); // Step 2: activeChat added to dependencies

  connectRef.current = connect;

  const sendMessage = useCallback((message) => {
    console.log("Attempting to send message via WS:", message);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    }
    console.warn("Cannot send message: WebSocket is not open.");
    return false;
  }, []);

  useEffect(() => {
    connect();

    const handleStorage = () => {
      if (hasSession() && !socketRef.current) {
        connect();
      }
    };

    const interval = setInterval(() => {
      if (hasSession() && !socketRef.current && !reconnectTimeoutRef.current) {
        connect();
      }
    }, 10000);

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleStorage);

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleStorage);
      clearInterval(interval);
    };
  }, [connect]);

  const value = {
    realtimeMessages,
    realtimeNotifications,
    unreadCount,
    activeChat,
    setActiveChat,
    sendMessage,
    markAsRead,
    setRealtimeMessages,
    setRealtimeNotifications,
    me,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
