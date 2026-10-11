import { API_BASE_URL } from '../constants/config';
import { storage } from './storageService';

// Singleton promise for concurrent 401 handling
let refreshPromise = null;

// Callbacks for session expiration (e.g. auth store redirect to login)
const sessionExpiredListeners = new Set();

export function onSessionExpired(callback) {
  sessionExpiredListeners.add(callback);
  return () => sessionExpiredListeners.delete(callback);
}

function notifySessionExpired() {
  sessionExpiredListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.warn('Session expired listener error:', e);
    }
  });
}

/**
 * Perform token refresh with concurrent call deduplication (mutex).
 * All concurrent 401s await this single promise.
 */
async function performTokenRefresh() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        throw new Error(`Token refresh failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.access_token) {
        throw new Error('No access token in refresh response');
      }

      // Save new access token
      await storage.saveToken(data.access_token);

      // Support refresh token rotation: save new refresh token if backend provided one
      if (data.refresh_token) {
        await storage.saveRefreshToken(data.refresh_token);
      }

      return data.access_token;
    } catch (err) {
      console.warn('[API] Refresh token expired or revoked, clearing session:', err.message);
      // Clean credentials from SecureStore and notify app to navigate to signin
      await storage.clearAuth();
      notifySessionExpired();
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function request(endpoint, options = {}, isRetry = false) {
  let token = await storage.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Detect 401 Unauthorized (exclude login/register/refresh endpoints)
    const isAuthEndpoint =
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/register') ||
      endpoint.includes('/auth/refresh');

    if (res.status === 401 && !isRetry && !isAuthEndpoint) {
      try {
        // Wait for single shared refresh
        const newAccessToken = await performTokenRefresh();

        // Retry original request once with new access token
        return request(
          endpoint,
          {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${newAccessToken}`,
            },
          },
          true // Mark as retry to prevent infinite loops
        );
      } catch (refreshErr) {
        throw new Error('Session expired. Please sign in again.');
      }
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export const authApi = {
  async register({ username, name, email, password }) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: username || (name ? name.toLowerCase().replace(/[^a-z0-9_]/g, '') : ''),
        display_name: name,
        email,
        password,
      }),
    });
  },

  async login({ identifier, email, password }) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: identifier || email,
        password,
      }),
    });
  },

  async getMe() {
    return request('/auth/me', { method: 'GET' });
  },

  async updateProfile({ username, name, bio, avatar }) {
    const payload = {};
    if (username !== undefined) payload.username = username;
    if (name !== undefined) payload.display_name = name;
    if (bio !== undefined) payload.bio = bio;

    // A device-local URI is not a URL the backend can access. Avatar uploads
    // must go through the media upload flow before saving avatar_url.
    if (typeof avatar === 'string' && (avatar.startsWith('https://') || avatar.startsWith('http://'))) {
      payload.avatar_url = avatar;
    }

    return request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async logout(refreshToken) {
    try {
      const token = refreshToken || (await storage.getRefreshToken());
      if (token) {
        await request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: token }),
        });
      }
    } catch (e) {
      console.warn('Server logout failed:', e.message);
    } finally {
      await storage.clearAuth();
    }
  },

  async verifyEmail(token) {
    return request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async resendVerification(email) {
    return request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async forgotPassword(email) {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token, newPassword) {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },
};

export const usersApi = {
  async search(query) {
    return request(`/users/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
  },

  async getByUsername(username) {
    const clean = username.replace(/^@/, '');
    return request(`/users/${encodeURIComponent(clean)}`, { method: 'GET' });
  },
};

export const mediaApi = {
  async getUploadURL({ fileName, contentType, sizeBytes }) {
    return request('/media/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        file_name: fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
      }),
    });
  },

  async getDownloadURL(storageKey) {
    return request('/media/download-url', {
      method: 'POST',
      body: JSON.stringify({ storage_key: storageKey }),
    });
  },
};

export const chatApi = {
  async getConversations() {
    return request('/chat/conversations', { method: 'GET' });
  },

  async createDirectConversation(recipientId) {
    return request('/chat/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId }),
    });
  },

  async createGroupConversation(title, memberIds) {
    return request('/chat/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ title, member_ids: memberIds }),
    });
  },

  async getMessages(conversationId, limit = 50, offset = 0) {
    return request(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}&offset=${offset}`,
      { method: 'GET' }
    );
  },

  async deleteConversation(conversationId) {
    return request(`/chat/conversations/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
    });
  },

  async deleteMessage(messageId) {
    return request(`/chat/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
    });
  },
};
