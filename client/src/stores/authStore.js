import { create } from 'zustand';
import { authApi, onSessionExpired } from '../services/apiService';
import { storage } from '../services/storageService';
import { wsService } from '../services/websocketService';
import { sqliteService } from '../database/sqliteService';

export const useAuthStore = create((set, get) => {
  // Listen for session expiration events from apiService
  onSessionExpired(() => {
    get().handleSessionExpired();
  });

  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,

    initAuth: async () => {
      try {
        set({ isLoading: true, error: null });
        const [savedToken, savedUser] = await Promise.all([
          storage.getToken(),
          storage.getUser(),
        ]);

        if (!savedToken) {
          wsService.disconnect();
          set({ isAuthenticated: false, user: null, token: null });
          return;
        }

        let currentUser = savedUser || null;
        try {
          const freshUser = await authApi.getMe();
          if (freshUser) {
            currentUser = freshUser;
            await storage.saveUser(freshUser);
          }
        } catch (e) {
          // Keep cached data for offline display, but never assume verification
          // from a failed network request when the cached user is unverified.
          console.warn('[AuthStore] Could not refresh user during auth init:', e.message);
        }

        const isVerified = currentUser?.is_verified === true;
        set({
          token: savedToken,
          user: currentUser,
          isAuthenticated: isVerified,
        });

        if (isVerified) {
          wsService.connect();
        } else {
          wsService.disconnect();
        }
      } catch (err) {
        console.warn('[AuthStore] initAuth error:', err);
        wsService.disconnect();
        set({ isAuthenticated: false, user: null, token: null });
      } finally {
        set({ isLoading: false });
      }
    },

    login: async (credentials) => {
      try {
        set({ isLoading: true, error: null });
        const res = await authApi.login(credentials);

        if (!res.access_token) {
          throw new Error('Invalid response from server');
        }

        await Promise.all([
          storage.saveToken(res.access_token),
          res.refresh_token ? storage.saveRefreshToken(res.refresh_token) : Promise.resolve(),
          res.user ? storage.saveUser(res.user) : Promise.resolve(),
        ]);

        set({
          user: res.user || null,
          token: res.access_token,
          isAuthenticated: true,
          isLoading: false,
        });

        // Initialize SQLite & connect WebSocket
        await sqliteService.init();
        wsService.connect();

        return { success: true };
      } catch (err) {
        set({ error: err.message, isLoading: false });
        return { success: false, error: err.message };
      }
    },

    register: async (payload) => {
      try {
        set({ isLoading: true, error: null });
        const res = await authApi.register(payload);

        if (res.access_token) {
          await Promise.all([
            storage.saveToken(res.access_token),
            res.refresh_token ? storage.saveRefreshToken(res.refresh_token) : Promise.resolve(),
            res.user ? storage.saveUser(res.user) : Promise.resolve(),
          ]);

          set({
            user: res.user || null,
            token: res.access_token,
            isAuthenticated: true,
            isLoading: false,
          });

          await sqliteService.init();
          wsService.connect();
          return { success: true };
        }

        set({ isLoading: false });
        return { success: true, message: res.message };
      } catch (err) {
        set({ error: err.message, isLoading: false });
        return { success: false, error: err.message };
      }
    },

    logout: async () => {
      try {
        set({ isLoading: true });
        const refreshToken = await storage.getRefreshToken();
        // Server-side revoke
        await authApi.logout(refreshToken);
      } catch (e) {
        console.warn('[AuthStore] Server logout notice failed:', e);
      } finally {
        // Disconnect WS and wipe local state
        wsService.disconnect();
        await storage.clearAuth();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    },

    handleSessionExpired: () => {
      wsService.disconnect();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Your session has expired. Please sign in again.',
      });
    },

    updateUserProfile: async (profileData) => {
      try {
        const updated = await authApi.updateProfile(profileData);
        const nextUser = { ...(get().user || {}), ...updated };
        set({ user: nextUser });
        await storage.saveUser(nextUser);
        return { success: true, user: nextUser };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  };
});
