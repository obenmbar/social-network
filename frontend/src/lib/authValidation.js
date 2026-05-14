const emailPattern = /^[A-Za-z0-9][A-Za-z0-9._%+\-]*@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const allowedAvatarTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const maxAvatarBytes = 2 * 1024 * 1024;

export const MaxEmailLen = 254;
export const MinNameLen = 2;
export const MaxNameLen = 10;
export const MinNicknameLen = 2;
export const MaxNicknameLen = 15;
export const MinAboutMeLen = 2;
export const MaxAboutMeLen = 50;

export function isValidEmail(email) {
  const value = email.trim();
  return value.length <= MaxEmailLen && emailPattern.test(value);
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

export function validateAuthFields(data) {
  const { email, password, first_name, last_name, nickname, about_me } = data;

  if (!isValidEmail(email)) {
    return "Email must be valid and start with a letter or digit.";
  }
  if (!isValidPassword(password)) {
    return "Password must be 8 to 24 ASCII characters.";
  }
  if (first_name !== undefined && (first_name.length < MinNameLen || first_name.length > MaxNameLen)) {
    return `First name must be ${MinNameLen} to ${MaxNameLen} characters.`;
  }
  if (last_name !== undefined && (last_name.length < MinNameLen || last_name.length > MaxNameLen)) {
    return `Last name must be ${MinNameLen} to ${MaxNameLen} characters.`;
  }
  if (nickname !== undefined && nickname && (nickname.length < MinNicknameLen || nickname.length > MaxNicknameLen)) {
    return `Nickname must be ${MinNicknameLen} to ${MaxNicknameLen} characters.`;
  }
  if (about_me !== undefined && about_me && (about_me.length < MinAboutMeLen || about_me.length > MaxAboutMeLen)) {
    return `About me must be ${MinAboutMeLen} to ${MaxAboutMeLen} characters.`;
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
