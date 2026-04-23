import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { User } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface AuthState {
  user: User | null;
  token: string | null;
  idToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string, idToken: string) => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithCognito: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      idToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, token, idToken) =>
        set({ user, token, idToken, isAuthenticated: true }),

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data } = await axios.post(`${API_URL}/auth/login`, { email, password });
          set({
            token: data.token,
            idToken: data.token,
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ isLoading: false });
          throw new Error(error.response?.data?.message || 'Credenciales inválidas');
        }
      },

      loginWithCognito: () => {
        const domain = import.meta.env.VITE_COGNITO_DOMAIN;
        const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
        const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
        window.location.href = `https://${domain}/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+email+profile`;
      },

      logout: () =>
        set({ user: null, token: null, idToken: null, isAuthenticated: false }),
    }),
    {
      name: 'elemental-pro-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        idToken: state.idToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
