import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface AuthState {
  token: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      login: async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("token", data.token);
        set({ token: data.token, email: data.user.email });
      },
      signup: async (email, password) => {
        const { data } = await api.post("/auth/signup", { email, password });
        localStorage.setItem("token", data.token);
        set({ token: data.token, email: data.user.email });
      },
      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, email: null });
      },
    }),
    { name: "auth" }
  )
);