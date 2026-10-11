import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import { secureStorage } from './secureStorage';

export const storage = {
  // Non-sensitive Profile Cache
  async saveUser(user) {
    try {
      if (user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      }
    } catch (e) {
      console.warn('Storage saveUser error:', e);
    }
  },

  async getUser() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('Storage getUser error:', e);
      return null;
    }
  },

  // Sensitive Tokens: delegates to Expo SecureStore
  async saveToken(token) {
    return secureStorage.saveAccessToken(token);
  },

  async getToken() {
    return secureStorage.getAccessToken();
  },

  async saveRefreshToken(token) {
    return secureStorage.saveRefreshToken(token);
  },

  async getRefreshToken() {
    return secureStorage.getRefreshToken();
  },

  // Non-sensitive Preferences
  async saveTheme(theme) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, theme);
    } catch (e) {}
  },

  async getTheme() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
    } catch (e) {
      return null;
    }
  },

  // Clear authentication credentials
  async clearAuth() {
    try {
      await secureStorage.clearAll();
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    } catch (e) {
      console.warn('clearAuth error:', e);
    }
  },
};
