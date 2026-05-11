export const sessionStorageKey = "social_network_session";

export function hasSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(sessionStorageKey) === "active";
}

export function saveSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(sessionStorageKey, "active");
}

export function removeSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(sessionStorageKey);
}
