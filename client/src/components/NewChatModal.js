import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useUIStore } from '../stores/uiStore';
import { UserAvatar } from './UserAvatar';
import { usersApi } from '../services/apiService';

export const NewChatModal = ({ visible, onClose, onSelectUser }) => {
  const { themeMode } = useUIStore();
  const theme = Colors[themeMode];
  const [search, setSearch] = useState('');
  const [backendUsers, setBackendUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  React.useEffect(() => {
    if (!search.trim()) {
      setBackendUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await usersApi.search(search.trim());
        if (Array.isArray(res)) {
          const mapped = res.map((u) => ({
            id: u.id,
            name: u.display_name || u.username,
            username: `@${u.username}`,
            avatar: u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            isOnline: u.is_online,
          }));
          setBackendUsers(mapped);
        }
      } catch (err) {
        console.warn('User search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  if (!visible) return null;

  const displayUsers = backendUsers;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheetContainer, { backgroundColor: theme.surface }]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>New Conversation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBox}>
            <View style={[styles.searchWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Feather name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Search username or name..."
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>
          </View>

          {/* Users List */}
          <FlatList
            data={displayUsers}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userRow}
                activeOpacity={0.7}
                onPress={() => {
                  onSelectUser(item);
                  onClose();
                }}
              >
                <UserAvatar
                  uri={item.avatar}
                  name={item.name}
                  size={46}
                  isOnline={item.isOnline}
                />
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.userHandle, { color: theme.primaryAccent || '#3B82F6' }]}>
                    {item.username}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No contacts found
                </Text>
              </View>
            )}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 4,
  },
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 1,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
