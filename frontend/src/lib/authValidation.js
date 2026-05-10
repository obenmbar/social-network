const emailPattern = /^[A-Za-z0-9][A-Za-z0-9._%+\-]*@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const allowedAvatarTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const maxAvatarBytes = 2 * 1024 * 1024;

export function isValidEmail(email) {
  return emailPattern.test(email.trim());
}

export function isValidPassword(password) {
  if (password.length < 8 || password.length > 24) {
    return false;
  }

  for (const char of password) {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) {
      return false;
    }
  }

  return true;
}

export function validateAuthFields({ email, password }) {
  if (!isValidEmail(email)) {
    return "Email must be valid and start with a letter or digit.";
  }
  if (!isValidPassword(password)) {
    return "Password must be 8 to 24 ASCII characters.";
  }
  return "";
}

export function validateSafeText(value) {
  return !/[<>]/.test(value);
}

export function validateAvatarFile(file) {
  if (!file) {
    return "";
  }
  if (!allowedAvatarTypes.has(file.type)) {
    return "Avatar must be a PNG, JPG, JPEG, WEBP, or GIF image.";
  }
  if (file.size > maxAvatarBytes) {
    return "Avatar must be under 2MB.";
  }
  return "";
}
