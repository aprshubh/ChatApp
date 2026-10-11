import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../../components/UserAvatar';
import { NewChatModal } from '../../components/NewChatModal';

export const ChatsTab = () => {
  const {
    themeMode,
    conversations,
    statuses,
    openConversation,
    startOrGetConversationWithUser,
    deleteConversation,
  } = useApp();

  const theme = Colors[themeMode];
  const [search, setSearch] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const filteredConversations = conversations.filter(
    (c) =>
      c.user.name.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerGreeting, { color: theme.textSecondary }]}>Direct</Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Messages</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.inputBg }]}
            activeOpacity={0.7}
            onPress={() => setIsNewChatModalOpen(true)}
          >
            <Feather name="edit-3" size={17} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchWrapper,
            { backgroundColor: theme.inputBg },
          ]}
        >
          <Feather name="search" size={15} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search conversations, contacts..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Stories Bar */}
      <View style={styles.storiesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScroll}
        >
          <TouchableOpacity
            style={styles.storyItem}
            activeOpacity={0.7}
            onPress={() => setIsNewChatModalOpen(true)}
          >
            <View style={[styles.addStoryCircle, { backgroundColor: theme.inputBg, borderColor: theme.borderMedium }]}>
              <Feather name="plus" size={20} color={theme.text} />
            </View>
            <Text style={[styles.storyName, { color: theme.textSecondary }]}>New Chat</Text>
          </TouchableOpacity>

          {statuses.map((item) => (
            <TouchableOpacity key={item.id} style={styles.storyItem} activeOpacity={0.7}>
              <View
                style={[
                  styles.storyRing,
                  {
                    borderColor: item.viewed ? theme.borderMedium : (theme.primaryAccent || '#3B82F6'),
                  },
                ]}
              >
                <UserAvatar
                  uri={item.user.avatar}
                  name={item.user.name}
                  size={46}
                  showBadge={false}
                />
              </View>
              <Text
                style={[styles.storyName, { color: theme.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.user.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: theme.border }]} />
        )}
        renderItem={({ item }) => {
          const isUnread = item.unreadCount > 0;
          return (
            <TouchableOpacity
              style={styles.chatRow}
              activeOpacity={0.65}
              onPress={() => openConversation(item)}
              onLongPress={() => {
                Alert.alert(
                  'Delete Chat',
                  `Do you want to delete conversation with ${item.user.name}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => deleteConversation(item.id),
                    },
                  ]
                );
              }}
            >
              <UserAvatar
                uri={item.user.avatar}
                name={item.user.name}
                size={50}
                isOnline={item.user.isOnline}
              />
              <View style={styles.chatInfo}>
                <View style={styles.chatTopRow}>
                  <Text
                    style={[
                      styles.userName,
                      {
                        color: theme.text,
                        fontWeight: isUnread ? '700' : '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.user.name}
                  </Text>
                  <Text
                    style={[
                      styles.chatTime,
                      {
                        color: isUnread ? (theme.primaryAccent || '#3B82F6') : theme.textMuted,
                        fontWeight: isUnread ? '600' : '400',
                      },
                    ]}
                  >
                    {item.time}
                  </Text>
                </View>

                <View style={styles.chatBottomRow}>
                  {item.pinned && (
                    <MaterialIcons
                      name="push-pin"
                      size={13}
                      color={theme.primaryAccent || '#3B82F6'}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.lastMessage,
                      {
                        color: isUnread ? theme.text : theme.textSecondary,
                        fontWeight: isUnread ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastMessage}
                  </Text>
                  {isUnread && (
                    <View style={[styles.unreadBadge, { backgroundColor: theme.primaryAccent || '#3B82F6' }]}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: theme.inputBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Feather name="message-square" size={28} color={theme.textMuted} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>
              No Conversations Yet
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              Search for users by username using the edit button above or tap "New Chat" to start messaging.
            </Text>
            <TouchableOpacity
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                backgroundColor: theme.primary,
                borderRadius: 12,
              }}
              onPress={() => setIsNewChatModalOpen(true)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>Find People</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Discover & Start New Chat Modal */}
      <NewChatModal
        visible={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onSelectUser={(selectedUser) => startOrGetConversationWithUser(selectedUser)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerGreeting: {
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 8,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  storiesContainer: {
    paddingVertical: 6,
  },
  storiesScroll: {
    paddingHorizontal: 16,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 14,
    width: 60,
  },
  addStoryCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  storyRing: {
    padding: 2,
    borderRadius: 27,
    borderWidth: 2,
    marginBottom: 5,
  },
  storyName: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 82,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 15.5,
    maxWidth: '75%',
    letterSpacing: -0.2,
  },
  chatTime: {
    fontSize: 11.5,
  },
  chatBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 13,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
});
