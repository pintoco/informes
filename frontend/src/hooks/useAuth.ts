import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'cognito';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TECHNICIAN';
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithCognito: () => void;
  handleCognitoCallback: () => Promise<void>;
  setToken: (token: string, user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setToken: (token: string, user: AuthUser) => {
        set({ token, user, isAuthenticated: true });
      },

      // ── Local auth (email/password) ──────────────────────
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

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        if (AUTH_MODE === 'cognito') {
          const domain = import.meta.env.VITE_COGNITO_DOMAIN;
          const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
          const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
          if (domain) {
            window.location.href = `https://${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(redirectUri)}`;
          }
        }
      },

      // ── Cognito auth ─────────────────────────────────────
      loginWithCognito: () => {
        const domain = import.meta.env.VITE_COGNITO_DOMAIN;
        const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
        const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;
        const url = `https://${domain}/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+email+profile`;
        window.location.href = url;
      },

      handleCognitoCallback: async () => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (!code) return;

        set({ isLoading: true });
        try {
          const domain = import.meta.env.VITE_COGNITO_DOMAIN;
          const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
          const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;

          const tokenRes = await axios.post(
            `https://${domain}/oauth2/token`,
            new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: clientId,
              code,
              redirect_uri: redirectUri,
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
          );

          const { id_token, access_token } = tokenRes.data;
          // Decode JWT to get user info
          const payload = JSON.parse(atob(id_token.split('.')[1]));
          const groups: string[] = payload['cognito:groups'] || [];

          const user: AuthUser = {
            id: payload.sub,
            email: payload.email,
            name: payload.name || payload.email,
            role: groups.includes('ADMIN') ? 'ADMIN' : 'TECHNICIAN',
          };

          set({ token: id_token, user, isAuthenticated: true, isLoading: false });
          window.history.replaceState({}, '', '/');
        } catch {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'elemental-pro-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);

export const isLocalAuthMode = () =>
  import.meta.env.VITE_AUTH_MODE === 'local';
