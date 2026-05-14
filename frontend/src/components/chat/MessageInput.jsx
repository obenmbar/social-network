"use client";

import React, { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function MessageInput({ target, onSendMessage }) {
  const [content, setContent] = useState("");
  const { sendMessage } = useWebSocket();

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!content.trim()) return;

    const isGroup = target?.type === "group";
    const messageData = {
      content: content.trim(),
    };

    if (isGroup) {
      messageData.group_id = target.id;
    } else {
      messageData.receiver_id = target.id;
    }

    if (onSendMessage) {
      onSendMessage(messageData);
    }

    console.log("Attempting to send message:", messageData);
    if (sendMessage(messageData)) {
      setContent("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={formStyle}>
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        style={inputStyle}
      />
      <button 
        type="button" 
        onClick={() => handleSend()} 
        style={buttonStyle}
        disabled={!content.trim()}
      >
        Send
      </button>
    </div>
  );
}

const formStyle = {
  display: "flex",
  padding: "1rem",
  borderTop: "1px solid #333",
  gap: "0.5rem",
  background: "#121212",
};

const inputStyle = {
  flex: 1,
  padding: "0.5rem 0.75rem",
  borderRadius: "20px",
  border: "1px solid #444",
  outline: "none",
  fontSize: "0.9rem",
  background: "#1e1e1e",
  color: "white",
};

const buttonStyle = {
  background: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "20px",
  padding: "0.5rem 1rem",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "0.9rem",
};
