import { Platform } from 'react-native';

// Your machine's Wi-Fi IP address (detected for physical device access)
const LAN_IP = '192.168.1.6';

// For Physical Phone / Expo Go on same Wi-Fi: uses LAN_IP (192.168.1.6:8080)
// For Android emulator: 10.0.2.2:8080
// For Web / Simulator: localhost:8080
export const API_BASE_URL = Platform.select({
  android: `http://${LAN_IP}:8080/api/v1`,
  ios: `http://${LAN_IP}:8080/api/v1`,
  default: `http://${LAN_IP}:8080/api/v1`,
});

export const WS_BASE_URL = Platform.select({
  android: `ws://${LAN_IP}:8080/ws`,
  ios: `ws://${LAN_IP}:8080/ws`,
  default: `ws://${LAN_IP}:8080/ws`,
});

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@chatapp_auth_token',
  REFRESH_TOKEN: '@chatapp_refresh_token',
  USER_DATA: '@chatapp_user_data',
  THEME_MODE: '@chatapp_theme_mode',
  CONVERSATIONS: '@chatapp_conversations',
  MESSAGES: '@chatapp_messages',
};
