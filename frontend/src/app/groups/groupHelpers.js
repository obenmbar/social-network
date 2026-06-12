"use client";

import { mediaUrl } from "@/lib/api";
import styles from "./Groups.module.css";

export function InviteSuggestions({ users, onSelect }) {
  return (
    <div className={styles.suggestions} role="listbox">
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          role="option"
          aria-selected="false"
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(user);
          }}
        >
          <strong>{displayName(user)}</strong>
          {user.nickname && <span>@{mentionHandle(user)}</span>}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ user, size = "default" }) {
  const initial = user?.first_name?.trim()?.charAt(0)?.toUpperCase() || "?";
  const className = size === "small" ? styles.avatarSmall : styles.avatar;

  return (
    <div className={className}>
      {user?.avatar ? (
        <span
          className={styles.avatarImage}
          style={{ backgroundImage: `url(${mediaUrl(user.avatar)})` }}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

export function getSubmitForm(event) {
  const form = event.currentTarget || event.target;
  return form instanceof HTMLFormElement ? form : null;
}

export function getMentionSuggestions(value, followers, allowCommaList, selectedUserIds = []) {
  const mention = getActiveMention(value, allowCommaList);
  const query = mention.toLowerCase();
  const selected = new Set(selectedUserIds);

  return followers
    .filter((user) => !selected.has(user.id))
    .filter((user) => {
      if (!query) {
        return true;
      }

      return (
        mentionHandle(user).toLowerCase().includes(query) ||
        displayName(user).toLowerCase().includes(query)
      );
    });
}

export function getActiveMention(value, allowCommaList) {
  const token = allowCommaList ? value.split(",").at(-1).trimStart() : value.trimStart();
  return token;
}

export function hasActiveMention(value, allowCommaList) {
  return Boolean(getActiveMention(value, allowCommaList));
}

export function appendMentionTrigger(value, allowCommaList) {
  if (!allowCommaList) {
    return value;
  }

  if (!value.trim()) return value;

  return value.trimEnd().endsWith(",") ? `${value.trimEnd()} ` : `${value}, `;
}

export function replaceMentionToken(value, label, allowCommaList) {
  const replacement = label;
  if (!allowCommaList) return replacement;
  const parts = value.split(",");
  parts[parts.length - 1] = ` ${label}`;
  return `${parts.join(",").trimStart()}, `;
}

export function displayName(user) {
  if (!user) return "Unknown user";
  return (
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    user.nickname ||
    "Unknown user"
  );
}

export function mentionHandle(user) {
  return user?.nickname?.trim()?.replace(/^@+/, "") || "";
}

export function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDateTimeLocal(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
