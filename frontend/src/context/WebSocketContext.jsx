
"use client";

import React, { createContext, useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { hasSession } from "@/lib/session";

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [realtimeMessages, setRealtimeMessages] = useState([]);
  const [realtimeNotifications, setRealtimeNotifications] = useState([]);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isFirstConnectionAfterLogin = useRef(true);
  const pathname = usePathname();

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
            // It's a notification
            setRealtimeNotifications((prev) => {
              if (prev.some((n) => n.id === newMsg.id)) return prev;
              return [newMsg, ...prev];
            });
          } else {
            // It's a chat message
            setRealtimeMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
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
          isFirstConnectionAfterLogin.current = true;
          return;
        }

        if (hasSession() && pathname !== "/login" && pathname !== "/register") {
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
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
  }, [pathname]);

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
    sendMessage,
    setRealtimeMessages,
    setRealtimeNotifications,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
