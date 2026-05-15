import { removeSession } from "./session";
import { MaxImageSizeBytes, MaxImageSizeMB } from "./limits";

const API_BASE = "/api/path";

async function fetchAPI(endpoint, method = "GET", body = null) {
  const isFormData = body instanceof FormData;
  const options = {
    method,
    headers: isFormData ? {} : {
      "Content-Type": "application/json",
    },
    credentials: "include",
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(apiUrl(endpoint), options);
  
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res);
    const error = new Error(errorMessage || `API Error: ${res.status}`);
    error.status = res.status;

    if (res.status === 401) {
      removeSession();
    }

    throw error;
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

async function getErrorMessage(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      return data.error || data.message;
    } catch (e) {
      return null;
    }
  }

  return res.text();
}

export async function login(email, password) {
  return fetchAPI("/login", "POST", { email, password });
}

export async function register(data) {
  return fetchAPI("/register", "POST", data);
}

export async function getCurrentUser() {
  return fetchAPI("/me");
}

export async function getFollowers(userId) {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  return fetchAPI(`/followers${query}`);
}

export async function getFollowing(userId) {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
  return fetchAPI(`/following${query}`);
}

export async function getUsers() {
  return fetchAPI("/users");
}

export async function getUserProfile(userId) {
  return fetchAPI(`/users/${userId}`);
}

export async function followUser(userId) {
  return fetchAPI(`/users/${userId}/follow`, "POST");
}

export async function unfollowUser(userId) {
  return fetchAPI(`/users/${userId}/follow`, "DELETE");
}

export async function getFollowRequests() {
  return fetchAPI("/follow-requests");
}

export async function respondToFollowRequest(requestId, status) {
  return fetchAPI(`/follow-requests/${requestId}/${status}`, "POST");
}

export async function updateProfileVisibility(isPublic) {
  return fetchAPI("/me/profile-visibility", "PATCH", { is_public: isPublic });
}

export async function acceptFollowRequest(requestId) {
  return respondToFollowRequest(requestId, "accepted");
}

export async function declineFollowRequest(requestId) {
  return respondToFollowRequest(requestId, "declined");
}

export async function logout() {
  return fetchAPI("/logout", "POST");
}

export async function getFeed() {
  return fetchAPI("/posts/feed");
}

export async function createPost({ title, content, privacy, allowedUserIds = [], image }) {
  validateImageSize(image);

  const formData = new FormData();
  formData.append("title", title);
  formData.append("content", content);
  formData.append("privacy", privacy);

  allowedUserIds.forEach((userId) => {
    formData.append("allowed_user_ids", userId);
  });

  if (image) {
    formData.append("image", image);
  }

  return fetchAPI("/posts", "POST", formData);
}

export async function getPost(postId) {
  return fetchAPI(`/posts/${postId}`);
}

export async function createComment(postId, { content, image }) {
  validateImageSize(image);

  const formData = new FormData();
  formData.append("content", content);

  if (image) {
    formData.append("image", image);
  }

  return fetchAPI(`/posts/${postId}/comments`, "POST", formData);
}

export async function getGroups() {
  return fetchAPI("/groups");
}

export async function createGroup({ title, description, inviteeNicknames = [] }) {
  return fetchAPI("/groups", "POST", {
    title,
    description,
    invitee_nicknames: inviteeNicknames,
  });
}

export async function getGroup(groupId) {
  return fetchAPI(`/groups/${groupId}`);
}

export async function getGroupInvitations() {
  return fetchAPI("/groups/invitations");
}

export async function inviteToGroup(groupId, nickname) {
  return fetchAPI(`/groups/${groupId}/invite`, "POST", { nickname });
}

export async function respondToGroupInvitation(groupId, status) {
  return fetchAPI(`/groups/${groupId}/invitations/${status}`, "POST");
}

export async function requestToJoinGroup(groupId) {
  return fetchAPI(`/groups/${groupId}/requests`, "POST");
}

export async function respondToGroupJoinRequest(groupId, userId, status) {
  return fetchAPI(`/groups/${groupId}/requests/${userId}/${status}`, "POST");
}

export async function createGroupPost(groupId, content) {
  return fetchAPI(`/groups/${groupId}/posts`, "POST", { content });
}

export async function getGroupPost(groupId, postId) {
  return fetchAPI(`/groups/${groupId}/posts/${postId}`);
}

export async function createGroupComment(groupId, postId, content) {
  return fetchAPI(`/groups/${groupId}/posts/${postId}/comments`, "POST", {
    content,
  });
}

export async function createGroupEvent(groupId, { title, description, eventTime }) {
  return fetchAPI(`/groups/${groupId}/events`, "POST", {
    title,
    description,
    event_time: eventTime,
  });
}

export async function respondToGroupEvent(groupId, eventId, response) {
  return fetchAPI(`/groups/${groupId}/events/${eventId}/responses`, "POST", {
    response,
  });
}

export async function getNotifications() {
  return fetchAPI("/notifications");
}

export async function getChatHistory(userId, cursor = "") {
  const params = new URLSearchParams({ user_id: userId });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return fetchAPI(`/chat/history?${params.toString()}`);
}

export async function getGroupChatHistory(groupId, cursor = "") {
  const params = new URLSearchParams({ group_id: groupId });
  if (cursor) {
    params.set("cursor", cursor);
  }
  return fetchAPI(`/chat/group/history?${params.toString()}`);
}

export async function markNotificationRead(notificationId) {
  return fetchAPI("/notifications/read", "POST", { id: notificationId });
}

export function mediaUrl(path) {
  if (!path) {
    return "";
  }

  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }

  return apiUrl(`/${path.replace(/^\/+/, "")}`);
}

function apiUrl(endpoint) {
  return `${API_BASE}?target=${encodeURIComponent(endpoint)}`;
}

export function isUnauthorized(err) {
  return err?.status === 401;
}

function validateImageSize(image) {
  if (image && image.size > MaxImageSizeBytes) {
    throw new Error(`Images must be ${MaxImageSizeMB} MB or smaller`);
  }
}
