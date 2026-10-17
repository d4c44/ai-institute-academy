import { apiSend } from "@/lib/api/browser";

export function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Ends the session on the server (which also clears the cookie). */
export async function signOut() {
  await apiSend("POST", "/api/v1/auth/logout");
}
