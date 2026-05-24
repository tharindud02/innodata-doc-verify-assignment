import axios from "axios";
import { clearAuthSession, getAuthToken } from "@/lib/auth-session";

export const api = axios.create({
  baseURL: "/api",
});

const AUTH_PATHS = ["/auth/login", "/auth/signup"];

function isAuthRequest(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status as number | undefined;
    const url = err.config?.url as string | undefined;

    if (status === 401 && !isAuthRequest(url)) {
      clearAuthSession();
      const onPublicPage =
        location.pathname.startsWith("/login") ||
        location.pathname.startsWith("/signup");
      if (!onPublicPage) {
        location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
