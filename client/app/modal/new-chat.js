import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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

export default function NewChatModalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { themeMode } = useUIStore();
  const theme = Colors[themeMode] || Colors.dark;

  const [search, setSearch] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const { data: users = [], isLoading } = useUserSearchQuery(search);

  const handleSelectUser = async (targetUser) => {
    try {
      setIsStarting(true);
      const conv = await chatApi.createDirectConversation(targetUser.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });

      router.dismiss();
      router.push({
        pathname: `/conversation/${conv.id}`,
        params: {
          title: targetUser.display_name || targetUser.username,
          avatar: targetUser.avatar_url || '',
          userId: targetUser.id,
        },
      });
    } catch (err) {
      console.warn('Failed to start conversation:', err);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>New Chat</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Start a direct message
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: theme.inputBg }]}
          onPress={() => router.dismiss()}
        >
          <Feather name="x" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <View style={[styles.searchInputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search username or name..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => handleSelectUser(item)}
              disabled={isStarting}
            >
              <UserAvatar uri={item.avatar_url} name={item.display_name || item.username} size={44} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]}>
                  {item.display_name || item.username}
                </Text>
                <Text style={[styles.handle, { color: theme.textSecondary }]}>
                  @{item.username}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                {search.length >= 2 ? 'No users found matching query' : 'Type at least 2 characters to search'}
              </Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
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
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInputWrapper: {
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
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  handle: {
    fontSize: 12.5,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13.5,
  },
});
