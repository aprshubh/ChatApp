import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '../../src/theme/colors';
import { useUIStore } from '../../src/stores/uiStore';
import { useUserSearchQuery, queryKeys } from '../../src/hooks/useChatQueries';
import { chatApi } from '../../src/services/apiService';
import { UserAvatar } from '../../src/components/UserAvatar';

export default function ContactsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { themeMode } = useUIStore();
  const theme = Colors[themeMode] || Colors.dark;

  const [query, setQuery] = useState('');
  const [startingChatWithId, setStartingChatWithId] = useState(null);

  const { data: users = [], isLoading } = useUserSearchQuery(query);

  const handleStartChat = async (targetUser) => {
    try {
      setStartingChatWithId(targetUser.id);
      const conv = await chatApi.createDirectConversation(targetUser.id);

      // Invalidate conversations cache to show in chats list
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });

      // Navigate to conversation screen
      router.push({
        pathname: `/conversation/${conv.id}`,
        params: {
          title: targetUser.display_name || targetUser.username,
          avatar: targetUser.avatar_url || '',
          userId: targetUser.id,
        },
      });
    } catch (err) {
      Alert.alert('Unable to start chat', err.message || 'Please check your connection and try again.');
    } finally {
      setStartingChatWithId(null);
    }
  };

  const renderItem = ({ item }) => {
    const isConnecting = startingChatWithId === item.id;
    return (
      <TouchableOpacity
        style={styles.userRow}
        activeOpacity={0.7}
        onPress={() => handleStartChat(item)}
        disabled={isConnecting}
      >
        <UserAvatar
          uri={item.avatar_url}
          name={item.display_name || item.username}
          size={48}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
            {item.display_name || item.username}
          </Text>
          <Text style={[styles.userHandle, { color: theme.textSecondary }]}>
            @{item.username}
          </Text>
          {item.bio ? (
            <Text style={[styles.userBio, { color: theme.textMuted }]} numberOfLines={1}>
              {item.bio}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionBox}>
          {isConnecting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <View style={[styles.chatIconBadge, { backgroundColor: theme.primaryMuted }]}>
              <Feather name="message-circle" size={18} color={theme.primary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Discover & Contacts</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Find anyone by username, email, or display name
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Type at least 2 letters to search..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : query.length >= 2 ? (
              <>
                <Feather name="user-x" size={40} color={theme.textMuted} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No users found</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  No accounts match "{query}". Try checking the spelling.
                </Text>
              </>
            ) : (
              <>
                <Feather name="users" size={40} color={theme.textMuted} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Find People</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Type a name or username in the search box above to find contacts.
                </Text>
              </>
            )}
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 12.5,
    marginBottom: 2,
  },
  userBio: {
    fontSize: 12,
  },
  actionBox: {
    marginLeft: 10,
  },
  chatIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 82,
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
  },
});
