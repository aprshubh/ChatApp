import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, usersApi, authApi } from '../services/apiService';
import { sqliteService } from '../database/sqliteService';

export const queryKeys = {
  conversations: ['conversations'],
  messages: (convId) => ['messages', convId],
  userSearch: (query) => ['users', 'search', query],
  profile: ['profile', 'me'],
};

/**
 * Hook to query conversations with SQLite local cache fallback
 */
export function useConversationsQuery() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: async () => {
      try {
        // Try server fetch
        const serverData = await chatApi.getConversations();
        const list = Array.isArray(serverData) ? serverData : serverData.conversations || [];

        // Save server conversations to SQLite for offline access
        for (const item of list) {
          await sqliteService.saveConversation(item);
        }

        return list;
      } catch (err) {
        console.warn('[Query] Remote getConversations failed, falling back to SQLite:', err.message);
        // Fallback to local SQLite conversations
        const localList = await sqliteService.getConversations();
        return localList;
      }
    },
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to query messages for a specific conversation
 */
export function useMessagesQuery(conversationId) {
  return useQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: async () => {
      if (!conversationId) return [];

      // 1. Get local messages from SQLite immediately
      const localMsgs = await sqliteService.getMessages(conversationId, 100);

      // 2. Fetch server messages in background if available
      try {
        const remote = await chatApi.getMessages(conversationId, 50, 0);
        const remoteList = Array.isArray(remote) ? remote : remote.messages || [];

        if (remoteList.length > 0) {
          await sqliteService.saveBatchMessages(remoteList);
          // Return fresh merged list from SQLite
          return await sqliteService.getMessages(conversationId, 100);
        }
      } catch (e) {
        console.warn('[Query] Remote messages fetch failed, using local SQLite:', e.message);
      }

      return localMsgs;
    },
    enabled: Boolean(conversationId),
  });
}

/**
 * Hook for searching users
 */
export function useUserSearchQuery(searchQuery) {
  return useQuery({
    queryKey: queryKeys.userSearch(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.trim().length < 2) return [];
      const res = await usersApi.search(searchQuery.trim());
      return Array.isArray(res) ? res : res.users || [];
    },
    enabled: Boolean(searchQuery && searchQuery.trim().length >= 2),
    staleTime: 1000 * 60, // 1 minute
  });
}
