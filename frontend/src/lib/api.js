const API_BASE = "/api";

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

export async function createPost({ content, privacy, allowedUserIds = [], image }) {
  const formData = new FormData();
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
  const formData = new FormData();
  formData.append("content", content);

  if (image) {
    formData.append("image", image);
  }

  return fetchAPI(`/posts/${postId}/comments`, "POST", formData);
}

export function mediaUrl(path) {
  if (!path) {
    return "";
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
}
