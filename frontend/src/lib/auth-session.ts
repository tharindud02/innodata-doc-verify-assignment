/** Bridges zustand auth state to axios without circular imports. */
export interface AuthSessionBridge {
  getToken: () => string | null;
  clearSession: () => void;
}

let bridge: AuthSessionBridge = {
  getToken: () => null,
  clearSession: () => {},
};

export function registerAuthSession(next: AuthSessionBridge): void {
  bridge = next;
}

export function getAuthToken(): string | null {
  return bridge.getToken();
}

export function clearAuthSession(): void {
  bridge.clearSession();
}
