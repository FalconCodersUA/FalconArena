const TOKEN_KEY = 'falconarena_access_token';
const USER_KEY = 'falconarena_auth_user';

export type AuthRole = 'ADMIN' | 'TEAM' | 'JURY' | 'ORGANIZER';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: AuthRole;
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (
      typeof parsed?.id === 'string' &&
      typeof parsed?.email === 'string' &&
      typeof parsed?.fullName === 'string' &&
      typeof parsed?.role === 'string'
    ) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(USER_KEY);
  }

  return null;
}

export function setAuthUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAuthRole() {
  return getAuthUser()?.role ?? null;
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}
