import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'chatapp_secure_refresh_token';
const ACCESS_TOKEN_KEY = 'chatapp_secure_access_token';

// In-memory fallback for web environment where SecureStore is not supported
const webMemoryStore = new Map();

const isSecureStoreAvailable = Platform.OS !== 'web';

export const secureStorage = {
  async saveRefreshToken(token) {
    try {
      if (!token) {
        return this.deleteRefreshToken();
      }
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      } else {
        webMemoryStore.set(REFRESH_TOKEN_KEY, token);
      }
    } catch (err) {
      console.warn('[SecureStore] saveRefreshToken error:', err);
    }
  },

  async getRefreshToken() {
    try {
      if (isSecureStoreAvailable) {
        return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      }
      return webMemoryStore.get(REFRESH_TOKEN_KEY) || null;
    } catch (err) {
      console.warn('[SecureStore] getRefreshToken error:', err);
      return null;
    }
  },

  async deleteRefreshToken() {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      } else {
        webMemoryStore.delete(REFRESH_TOKEN_KEY);
      }
    } catch (err) {
      console.warn('[SecureStore] deleteRefreshToken error:', err);
    }
  },

  async saveAccessToken(token) {
    try {
      if (!token) {
        return this.deleteAccessToken();
      }
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
      } else {
        webMemoryStore.set(ACCESS_TOKEN_KEY, token);
      }
    } catch (err) {
      console.warn('[SecureStore] saveAccessToken error:', err);
    }
  },

  async getAccessToken() {
    try {
      if (isSecureStoreAvailable) {
        return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      }
      return webMemoryStore.get(ACCESS_TOKEN_KEY) || null;
    } catch (err) {
      console.warn('[SecureStore] getAccessToken error:', err);
      return null;
    }
  },

  async deleteAccessToken() {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      } else {
        webMemoryStore.delete(ACCESS_TOKEN_KEY);
      }
    } catch (err) {
      console.warn('[SecureStore] deleteAccessToken error:', err);
    }
  },

  async clearAll() {
    await Promise.all([
      this.deleteRefreshToken(),
      this.deleteAccessToken(),
    ]);
  },
};
