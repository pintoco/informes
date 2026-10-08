import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { User } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  // Recarga el perfil desde el backend (teléfono, email de contacto, rol actualizado)
  refreshUser: () => Promise<void>;
  setSession: (user: User, token?: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
          set({
            token: data.token,
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Credenciales inválidas');
        }
      },

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),

      refreshUser: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const { data } = await axios.get<User>(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          set({ user: data });
        } catch (error: any) {
          if (error.response?.status === 401) get().logout();
        }
      },

      setSession: (user, token) =>
        set((state) => ({ user, token: token ?? state.token })),
    }),
    {
      name: 'elemental-pro-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
