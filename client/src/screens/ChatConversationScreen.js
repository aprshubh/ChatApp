import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { UserAvatar } from '../components/UserAvatar';

export const ChatConversationScreen = () => {
  const {
    themeMode,
    activeConversation,
    closeConversation,
    messagesMap = {},
    sendMessage,
    deleteConversation,
    deleteMessage,
    addCallRecord,
  } = useApp();

  const insets = useSafeAreaInsets();
  const theme = Colors[themeMode] || Colors.light;
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const flatListRef = useRef(null);

  if (!activeConversation) {
    return null;
  }

  // Safe user resolution to prevent undefined property crashes
  const convUser = activeConversation.user || {
    id: activeConversation.id,
    name: activeConversation.title || 'Chat',
    username: '@chat',
    avatar: activeConversation.avatar_url || '',
    isOnline: false,
    lastSeen: 'Offline',
  };

  const messages = (activeConversation.id && messagesMap[activeConversation.id]) || [];

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Needed', 'Allow photo library access to attach images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'Images',
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].uri) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Error attaching photo:', e);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() && !selectedImage) return;
    sendMessage(activeConversation.id, inputText, selectedImage);
    setInputText('');
    setSelectedImage(null);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
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
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 10),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={closeConversation}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={24} color={theme.text} />
        </TouchableOpacity>

        <UserAvatar
          uri={convUser.avatar}
          name={convUser.name}
          size={38}
          isOnline={convUser.isOnline}
        />

        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
            {convUser.name}
          </Text>
          <Text
            style={[
              styles.headerStatus,
              {
                color: convUser.isOnline ? theme.accent : theme.textSecondary,
              },
            ]}
          >
            {convUser.isOnline ? 'Active now' : convUser.lastSeen || 'Offline'}
          </Text>
        </View>

        {/* Shortcuts for calls & Delete Chat */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: theme.inputBg }]}
            onPress={() => addCallRecord && addCallRecord(convUser, 'audio')}
          >
            <Feather name="phone" size={17} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: theme.inputBg }]}
            onPress={() => addCallRecord && addCallRecord(convUser, 'video')}
          >
            <Feather name="video" size={17} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: theme.danger + '14' }]}
            onPress={() => {
              Alert.alert(
                'Delete Conversation',
                'Are you sure you want to delete this entire chat conversation? Messages will be cleared.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteConversation && deleteConversation(activeConversation.id),
                  },
                ]
              );
            }}
          >
            <Feather name="trash-2" size={16} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item?.id ? String(item.id) : String(index)}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (!item) return null;
          const isMe = !!item.isMe;
          return (
            <View
              style={[
                styles.messageRow,
                isMe ? styles.messageRowMe : styles.messageRowPeer,
              ]}
            >
              {!isMe && (
                <View style={styles.peerAvatar}>
                  <UserAvatar
                    uri={convUser.avatar}
                    name={convUser.name}
                    size={26}
                    showBadge={false}
                  />
                </View>
              )}
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => {
                  Alert.alert(
                    'Message Options',
                    item.text || 'Selected message',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete Message',
                        style: 'destructive',
                        onPress: () => deleteMessage && deleteMessage(activeConversation.id, item.id),
                      },
                    ]
                  );
                }}
                style={[
                  styles.bubble,
                  isMe
                    ? [styles.bubbleMe, { backgroundColor: theme.bubbleMe }]
                    : [styles.bubblePeer, { backgroundColor: theme.bubblePeer }],
                ]}
              >
                {/* Attached Image if any */}
                {!!item.imageUri && (
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.attachedImage}
                  />
                )}
                {!!item.text && (
                  <Text
                    style={[
                      styles.messageText,
                      {
                        color: isMe ? theme.bubbleMeText : theme.bubblePeerText,
                      },
                    ]}
                  >
                    {item.text}
                  </Text>
                )}
                <View style={styles.messageMeta}>
                  <Text
                    style={[
                      styles.messageTime,
                      {
                        color: isMe ? 'rgba(255,255,255,0.65)' : theme.textMuted,
                      },
                    ]}
                  >
                    {item.time || ''}
                  </Text>
                  {isMe && (
                    <Feather
                      name="check"
                      size={11}
                      color="rgba(255,255,255,0.85)"
                      style={{ marginLeft: 3 }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Photo Preview Thumbnail Bar before sending */}
      {!!selectedImage && (
        <View style={[styles.previewBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <Image source={{ uri: selectedImage }} style={styles.previewThumb} />
          <TouchableOpacity
            style={styles.removeImageBtn}
            onPress={() => setSelectedImage(null)}
          >
            <Feather name="x" size={14} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={[styles.previewText, { color: theme.textSecondary }]}>Attached image ready to send</Text>
        </View>
      )}

      {/* Input Bottom Bar */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <TouchableOpacity style={styles.attachBtn} onPress={pickImage} activeOpacity={0.7}>
          <Feather name="image" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: theme.inputBg },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: (inputText.trim() || selectedImage) ? theme.primary : theme.primaryMuted,
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() && !selectedImage}
          activeOpacity={0.8}
        >
          <Feather
            name="arrow-up"
            size={18}
            color={(inputText.trim() || selectedImage) ? '#FFFFFF' : theme.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 4,
    marginRight: 6,
  },
  headerInfo: {
    marginLeft: 10,
    flex: 1,
  },
  headerName: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerStatus: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowPeer: {
    justifyContent: 'flex-start',
  },
  peerAvatar: {
    marginRight: 6,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubblePeer: {
    borderBottomLeftRadius: 4,
  },
  attachedImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 6,
    resizeMode: 'cover',
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 3,
  },
  messageTime: {
    fontSize: 10,
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  removeImageBtn: {
    position: 'absolute',
    left: 48,
    top: 6,
    backgroundColor: '#000000',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    marginLeft: 16,
    fontSize: 12.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: {
    padding: 6,
    marginRight: 4,
  },
  inputWrapper: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    height: '100%',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
