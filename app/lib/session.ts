export interface ToronetSession {
  identifier: string;
  address: string;
  password: string;
  username?: string;
  loggedInAt: string;
}

const TORONET_SESSION_KEY = "toronet.session.v1";

export function getStoredSession(): ToronetSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const serialized = window.localStorage.getItem(TORONET_SESSION_KEY);
  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as ToronetSession;
    if (!parsed?.address || !parsed?.password || !parsed?.identifier) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: ToronetSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TORONET_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TORONET_SESSION_KEY);
}
