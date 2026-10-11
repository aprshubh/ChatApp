import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../src/theme/colors';
import { useUIStore } from '../../src/stores/uiStore';
import { useAuthStore } from '../../src/stores/authStore';
import { sqliteService } from '../../src/database/sqliteService';
import { wsService } from '../../src/services/websocketService';
import { chatApi } from '../../src/services/apiService';
import { UserAvatar } from '../../src/components/UserAvatar';

export default function ConversationPage() {
  const router = useRouter();
  const { id: conversationId, title = 'Chat', avatar = '', userId = '' } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { themeMode, drafts, setDraft, clearDraft } = useUIStore();
  const { user } = useAuthStore();
  const theme = Colors[themeMode] || Colors.dark;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState(drafts[conversationId] || '');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const flatListRef = useRef(null);

  // Load message history from SQLite + Sync from Server
  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      try {
        setIsLoadingHistory(true);
        // 1. Instant SQLite read
        const local = await sqliteService.getMessages(conversationId, 100);
        if (isMounted) {
          setMessages(local);
          setIsLoadingHistory(false);
        }

        // 2. Fetch server updates in background
        try {
          const remote = await chatApi.getMessages(conversationId, 50, 0);
          const remoteList = Array.isArray(remote) ? remote : remote.messages || [];
          if (remoteList.length > 0 && isMounted) {
            await sqliteService.saveBatchMessages(remoteList);
            const merged = await sqliteService.getMessages(conversationId, 100);
            if (isMounted) setMessages(merged);
          }
        } catch (e) {
          console.warn('[Conversation] Remote fetch failed, relying on SQLite:', e.message);
        }
      } catch (err) {
        console.warn('[Conversation] Error loading messages:', err);
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    }

    loadHistory();

    // 3. Real-time WebSocket Listeners
    const unsubDeliver = wsService.on('message.deliver', async (payload) => {
      if (payload && payload.conversation_id === conversationId) {
        // Message was already saved to SQLite by websocketService before ACK
        const updated = await sqliteService.getMessages(conversationId, 100);
        if (isMounted) setMessages(updated);
      }
    });

    const unsubAck = wsService.on('message.ack', async (payload) => {
      if (payload && (payload.conversation_id === conversationId || payload.client_msg_id)) {
        const updated = await sqliteService.getMessages(conversationId, 100);
        if (isMounted) setMessages(updated);
      }
    });

    return () => {
      isMounted = false;
      unsubDeliver();
      unsubAck();
    };
  }, [conversationId]);

  // Persist draft on text change
  const handleTextChange = (text) => {
    setInputText(text);
    if (text) {
      setDraft(conversationId, text);
    } else {
      clearDraft(conversationId);
    }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please enable media library access to attach photos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'Images',
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setSelectedImage(res.assets[0].uri);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  };

  const handleSend = async () => {
    const textToSend = inputText.trim();
    if (!textToSend && !selectedImage) return;

    // Send via WebSocket (which automatically saves to SQLite and handles offline outbox)
    const { clientMsgId, queued } = wsService.sendMessage({
      conversationId,
      recipientId: userId,
      content: textToSend,
      mediaUrl: selectedImage,
    });

    // Clear composer and draft
    setInputText('');
    setSelectedImage(null);
    clearDraft(conversationId);

    // Refresh UI list from SQLite
    const updated = await sqliteService.getMessages(conversationId, 100);
    setMessages(updated);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Feather name="clock" size={11} color={theme.textMuted} style={{ marginLeft: 4 }} />;
      case 'sent':
        return <Feather name="check" size={12} color={theme.textMuted} style={{ marginLeft: 4 }} />;
      case 'delivered':
        return (
          <View style={{ flexDirection: 'row', marginLeft: 4 }}>
            <Feather name="check" size={12} color={theme.textMuted} />
            <Feather name="check" size={12} color={theme.textMuted} style={{ marginLeft: -6 }} />
          </View>
        );
      case 'read':
        return (
          <View style={{ flexDirection: 'row', marginLeft: 4 }}>
            <Feather name="check" size={12} color={theme.primary} />
            <Feather name="check" size={12} color={theme.primary} style={{ marginLeft: -6 }} />
          </View>
        );
      default:
        return null;
    }
  };

  const renderMessageItem = ({ item }) => {
    const isMe = item.sender_id === (user?.id || 'me') || item.sender_id === 'me';
    const timeStr = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowOther]}>
        <View
          style={[
            styles.bubble,
            isMe
              ? [styles.bubbleMe, { backgroundColor: theme.primary }]
              : [styles.bubbleOther, { backgroundColor: theme.surface, borderColor: theme.border }],
          ]}
        >
          {item.media_url ? (
            <Image
              source={{ uri: item.media_url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : null}

          {item.content ? (
            <Text
              style={[
                styles.messageText,
                { color: isMe ? '#FFFFFF' : theme.text },
              ]}
            >
              {item.content}
            </Text>
          ) : null}

          <View style={styles.bubbleFooter}>
            <Text
              style={[
                styles.messageTime,
                { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textMuted },
              ]}
            >
              {timeStr}
            </Text>
            {isMe && renderStatusIcon(item.status)}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 10),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={26} color={theme.text} />
        </TouchableOpacity>

        <UserAvatar uri={avatar} name={title} size={38} />

        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            {wsService.isConnected ? 'Connected' : 'Offline (Outbox Active)'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => Alert.alert('Chat Info', `Conversation ID:\n${conversationId}`)}
        >
          <Feather name="info" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Messages Feed */}
      {isLoadingHistory ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || item.client_msg_id || `msg_${index}`}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyFeed}>
              <Feather name="message-circle" size={40} color={theme.textMuted} style={{ marginBottom: 10 }} />
              <Text style={[styles.emptyFeedTitle, { color: theme.text }]}>No messages yet</Text>
              <Text style={[styles.emptyFeedSub, { color: theme.textSecondary }]}>
                Send a message to begin the conversation. Messages are safely cached locally.
              </Text>
            </View>
          }
        />
      )}

      {/* Image Preview if picked */}
      {selectedImage ? (
        <View style={[styles.imagePreviewBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Image source={{ uri: selectedImage }} style={styles.previewThumb} />
          <TouchableOpacity
            style={[styles.removeImageBtn, { backgroundColor: theme.danger || '#EF4444' }]}
            onPress={() => setSelectedImage(null)}
          >
            <Feather name="x" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Input Composer */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.attachBtn, { backgroundColor: theme.inputBg }]}
          onPress={pickImage}
          activeOpacity={0.7}
        >
          <Feather name="image" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.inputBg,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          maxHeight={100}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: inputText.trim() || selectedImage ? theme.primary : theme.border,
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() && !selectedImage}
          activeOpacity={0.8}
        >
          <Feather name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActionBtn: {
    padding: 8,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 10,
    marginBottom: 6,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  emptyFeed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 120,
  },
  emptyFeedTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyFeedSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
  },
  previewThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  removeImageBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14.5,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
