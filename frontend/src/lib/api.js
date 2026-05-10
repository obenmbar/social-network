const API_BASE = "/api";
const MAX_IMAGE_SIZE = 10 << 20;

/**
 * Handles backend requests with credentials to pass cookies automatically.
 */
async function fetchAPI(endpoint, method = "GET", body = null) {
  const isFormData = body instanceof FormData;
  const options = {
    method,
    headers: isFormData ? {} : {
      "Content-Type": "application/json",
    },
    credentials: "include", // Essential for Go session cookies
  };

  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res);
    throw new Error(errorMessage || `API Error: ${res.status}`);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

async function getErrorMessage(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return data.error || data.message;
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

export async function logout() {
  return fetchAPI("/logout", "POST");
}

export async function getFeed() {
  return fetchAPI("/posts/feed");
}

export async function getFollowers() {
  return fetchAPI("/followers");
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

export async function createGroup({ title, description, inviteeIds = [] }) {
  return fetchAPI("/groups", "POST", {
    title,
    description,
    invitee_ids: inviteeIds,
  });
}

export async function getGroup(groupId) {
  return fetchAPI(`/groups/${groupId}`);
}

export async function getGroupInvitations() {
  return fetchAPI("/groups/invitations");
}

export async function inviteToGroup(groupId, userId) {
  return fetchAPI(`/groups/${groupId}/invite`, "POST", { user_id: userId });
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

  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
}

function validateImageSize(image) {
  if (image && image.size > MAX_IMAGE_SIZE) {
    throw new Error("Images must be 10 MB or smaller");
  }
}
