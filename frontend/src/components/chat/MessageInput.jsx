"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useWebSocket } from "@/hooks/useWebSocket";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export default function MessageInput({ target, onSendMessage }) {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
      setShowEmojiPicker(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiClick = (emojiData) => {
    setContent((prev) => prev + emojiData.emoji);
  };

  return (
    <div style={formStyle}>
      <div style={emojiPickerContainerStyle}>
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          style={emojiButtonStyle}
          title="Add emoji"
        >
          😀
        </button>
        {showEmojiPicker && (
          <div style={pickerWrapperStyle}>
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              theme="dark"
              searchDisabled
              skinTonesDisabled
              width={300}
              height={400}
            />
          </div>
        )}
      </div>
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
  position: "relative",
};

const emojiPickerContainerStyle = {
  display: "flex",
  alignItems: "center",
};

const emojiButtonStyle = {
  background: "none",
  border: "none",
  fontSize: "1.2rem",
  cursor: "pointer",
  padding: "0 0.5rem",
};

const pickerWrapperStyle = {
  position: "absolute",
  bottom: "100%",
  left: "10px",
  marginBottom: "10px",
  zIndex: 1000,
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
