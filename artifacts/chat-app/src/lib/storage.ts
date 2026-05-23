export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}
export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}
export function clearToken(): void {
  localStorage.removeItem("auth_token");
}

export function getUsername(): string | null {
  return localStorage.getItem("username") || sessionStorage.getItem("username");
}
export function setUsername(username: string): void {
  localStorage.setItem("username", username);
}
export function clearUsername(): void {
  localStorage.removeItem("username");
  sessionStorage.removeItem("username");
}

export function getIsAdmin(): boolean {
  return localStorage.getItem("isAdmin") === "true";
}
export function setIsAdmin(): void {
  localStorage.setItem("isAdmin", "true");
}
export function clearIsAdmin(): void {
  localStorage.removeItem("isAdmin");
  sessionStorage.removeItem("isAdmin");
}

export function getAvatar(username: string): string | null {
  return localStorage.getItem(`avatar_${username}`);
}
export function setAvatar(username: string, url: string): void {
  localStorage.setItem(`avatar_${username}`, url);
}

export function clearAll(): void {
  clearToken();
  clearUsername();
  clearIsAdmin();
}
