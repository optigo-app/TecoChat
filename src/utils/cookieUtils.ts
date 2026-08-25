/**
 * Sets a cookie in the browser
 * @param name - Name of the cookie
 * @param value - Value to store (will be stringified if object)
 * @param days - Number of days until expiration
 */
export const setCookie = (name: string, value: unknown, days?: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  document.cookie =
    name + "=" + (stringValue || "") + expires + "; path=/; SameSite=Lax";
};

/**
 * Gets a cookie by name
 * @param name - Name of the cookie
 * @returns Value of the cookie or null if not found
 */
export const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

/**
 * Erases a cookie by name
 * @param name - Name of the cookie
 */
export const eraseCookie = (name: string) => {
  document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
};
