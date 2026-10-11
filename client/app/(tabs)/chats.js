import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { useUIStore } from '../../src/stores/uiStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useConversationsQuery, queryKeys } from '../../src/hooks/useChatQueries';
import { wsService } from '../../src/services/websocketService';
import { chatApi } from '../../src/services/apiService';
import { UserAvatar } from '../../src/components/UserAvatar';

export default function ChatsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { themeMode } = useUIStore();
  const { user } = useAuthStore();
  const theme = Colors[themeMode] || Colors.dark;

  const [search, setSearch] = useState('');
  const [wsConnected, setWsConnected] = useState(wsService.isConnected);

  const { data: conversations = [], isLoading, refetch } = useConversationsQuery();

  // Listen to live WebSocket events to invalidate conversations cache
  useEffect(() => {
    const unsubDeliver = wsService.on('message.deliver', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    });
    const unsubAck = wsService.on('message.ack', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    });
    const unsubState = wsService.on('connection.state', ({ connected }) => {
      setWsConnected(connected);
    });

    return () => {
      unsubDeliver();
      unsubAck();
      unsubState();
    };
  }, [queryClient]);

  const filtered = conversations.filter((c) => {
    const title = (c.title || c.name || '').toLowerCase();
    const lastMsg = (c.last_message || c.lastMessage || '').toLowerCase();
    const q = search.toLowerCase();
    return title.includes(q) || lastMsg.includes(q);
  });

  const handleDelete = (convId, title) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete chat with "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatApi.deleteConversation(convId);
              queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            } catch (e) {
              Alert.alert('Error', 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const title = item.title || item.name || 'Conversation';
    const lastMessage = item.last_message || (typeof item.lastMessage === 'string' ? item.lastMessage : item.lastMessage?.content) || 'No messages yet';
    const avatar = item.avatar_url || item.avatar;
    const isUnread = (item.unread_count || item.unreadCount || 0) > 0;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => {
          router.push({
            pathname: `/conversation/${item.id}`,
            params: {
              title,
              avatar: avatar || '',
              type: item.type || 'direct',
            },
          });
        }}
        onLongPress={() => handleDelete(item.id, title)}
      >
        <UserAvatar uri={avatar} name={title} size={50} isOnline={false} />
        <View style={styles.chatInfo}>
          <View style={styles.chatTopRow}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.timeText, { color: theme.textMuted }]}>
              {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </Text>
          </View>
          <View style={styles.chatBottomRow}>
            <Text
              style={[
                styles.lastMsgText,
                { color: isUnread ? theme.text : theme.textSecondary },
                isUnread && styles.unreadTextBold,
              ]}
              numberOfLines={1}
            >
              {lastMessage}
            </Text>
            {isUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                <Text style={styles.unreadCountText}>{item.unread_count || item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Chats</Text>
            {/* Live WS indicator */}
            <View
              style={[
                styles.statusDot,
                { backgroundColor: wsConnected ? '#10B981' : '#EF4444' },
              ]}
            />
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {user?.name || user?.username || 'Messages'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: theme.primaryMuted }]}
          onPress={() => router.push('/(tabs)/contacts')}
          activeOpacity={0.8}
        >
          <Feather name="edit" size={18} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Feather name="message-square" size={44} color={theme.textMuted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Conversations Yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Tap the new chat button to find users and start a conversation.
              </Text>
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme.primary }]}
                onPress={() => router.push('/(tabs)/contacts')}
              >
                <Text style={styles.startBtnText}>Find People</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  newChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  listContent: {
    flexGrow: 1,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
  },
  chatBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMsgText: {
    fontSize: 13.5,
    flex: 1,
    marginRight: 8,
  },
  unreadTextBold: {
    fontWeight: '700',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCountText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 84,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  startBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
