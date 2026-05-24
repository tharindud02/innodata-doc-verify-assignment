import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { AuthResponse } from "@/types/api";

interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

function applyAuthResponse(
  set: (partial: Pick<AuthState, "token" | "userId" | "email">) => void,
  data: AuthResponse
): void {
  set({
    token: data.token,
    userId: data.user.id,
    email: data.user.email,
  });
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      email: null,
      login: async (email, password) => {
        const { data } = await api.post<AuthResponse>("/auth/login", {
          email,
          password,
        });
        applyAuthResponse(set, data);
      },
      signup: async (email, password) => {
        const { data } = await api.post<AuthResponse>("/auth/signup", {
          email,
          password,
        });
        applyAuthResponse(set, data);
      },
      logout: () => set({ token: null, userId: null, email: null }),
    }),
    { name: "auth" }
  )
);
