import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../services/storageService';
import { authApi, usersApi, chatApi } from '../services/apiService';
import { wsService } from '../services/websocketService';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState('light');
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Registration cache step (Name, Email, Password -> Step 2 Choose Username)
  const [registerCache, setRegisterCache] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [currentScreen, setCurrentScreen] = useState('register');
  const [activeTab, setActiveTab] = useState('chats');
  const [activeConversation, setActiveConversation] = useState(null);

  // Pure Live Backend Data states (zero mock/demo data)
  const [conversations, setConversations] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [calls, setCalls] = useState([]);
  const [messagesMap, setMessagesMap] = useState({});

  // Auto-restore session and theme on app startup
  useEffect(() => {
    async function restoreSession() {
      try {
        const savedUser = await storage.getUser();
        const savedTheme = await storage.getTheme();
        const token = await storage.getToken();

        if (savedTheme) {
          setThemeMode(savedTheme);
        }

        if (savedUser && token) {
          setCurrentUser(savedUser);
          setCurrentScreen('main');

          // Verify token and fetch fresh profile from PostgreSQL
          authApi.getMe()
            .then((fresh) => {
              if (fresh && fresh.id) {
                const normalized = {
                  id: fresh.id,
                  name: fresh.display_name,
                  email: fresh.email,
                  username: `@${fresh.username}`,
                  bio: fresh.bio || 'Available',
                  avatar: fresh.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250',
                  isOnline: fresh.is_online,
                };
                setCurrentUser(normalized);
                storage.saveUser(normalized);
              }
            })
            .catch(() => {});
        } else {
          setCurrentScreen('register');
        }
      } catch (err) {
        console.warn('Failed restoring state', err);
      } finally {
        setIsInitializing(false);
      }
    }
    restoreSession();
  }, []);

  // Connect WebSocket when user is logged in
  useEffect(() => {
    if (currentUser && currentUser.id) {
      wsService.connect();

      // Listen for incoming live/queued messages from server
      const unsubDeliver = wsService.on('message.deliver', (payload) => {
        if (!payload) return;
        const convId = payload.conversation_id;
        const now = new Date(payload.created_at || Date.now());
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const incomingMsg = {
          id: payload.message_id || 'm_' + Date.now(),
          senderId: payload.sender_id,
          text: payload.content || '',
          imageUri: payload.media_url || null,
          time: timeStr,
          isMe: payload.sender_id === currentUser.id,
        };

        setMessagesMap((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] || []).filter((m) => m.id !== incomingMsg.id), incomingMsg],
        }));

        const preview = payload.media_url ? '📷 Photo' : (payload.content || '');
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, lastMessage: preview, time: timeStr, unreadCount: c.unreadCount + 1 }
              : c
          )
        );
      });

      // Fetch user conversations from backend PostgreSQL
      chatApi.getConversations()
        .then((backendConvs) => {
          if (Array.isArray(backendConvs) && backendConvs.length > 0) {
            const mapped = backendConvs.map((bc) => ({
              id: bc.id,
              user: bc.recipient ? {
                id: bc.recipient.id,
                name: bc.recipient.display_name,
                username: `@${bc.recipient.username}`,
                avatar: bc.recipient.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250',
                bio: 'Available',
                isOnline: bc.recipient.is_online,
                lastSeen: bc.recipient.is_online ? 'Active now' : 'Offline',
              } : {
                id: bc.id,
                name: bc.title || 'Group',
                username: '@group',
                avatar: bc.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250',
                bio: 'Group conversation',
                isOnline: false,
                lastSeen: '',
              },
              lastMessage: bc.last_message || 'Started conversation',
              time: bc.last_message_at ? new Date(bc.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
              unreadCount: bc.unread_count || 0,
              pinned: false,
            }));
            setConversations(mapped);
          }
        })
        .catch((e) => console.log('Notice: Local conversation state in use'));

      return () => {
        unsubDeliver();
      };
    } else {
      wsService.disconnect();
    }
  }, [currentUser]);

  const toggleTheme = () => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
    storage.saveTheme(nextTheme);
  };

  const handleRegisterDetails = ({ name, email, password }) => {
    setRegisterCache({ name, email, password });
    setCurrentScreen('username_setup');
  };

  const handleCompleteUsername = async ({ username, bio }) => {
    try {
      const resp = await authApi.register({
        username,
        name: registerCache.name,
        email: registerCache.email,
        password: registerCache.password,
      });

      if (resp.access_token) {
        await storage.saveToken(resp.access_token);
      }
      if (resp.refresh_token) {
        await storage.saveRefreshToken(resp.refresh_token);
      }

      const u = resp.user || {};
      const user = {
        id: u.id,
        name: u.display_name || registerCache.name,
        email: u.email || registerCache.email,
        username: `@${u.username || username}`,
        bio: bio || u.bio || 'Available',
        avatar: u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=250',
        isOnline: true,
      };

      setCurrentUser(user);
      await storage.saveUser(user);
      setCurrentScreen('main');
      setActiveTab('chats');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleSignIn = async ({ email, password }) => {
    try {
      const resp = await authApi.login({
        identifier: email,
        password,
      });

      if (resp.access_token) {
        await storage.saveToken(resp.access_token);
      }
      if (resp.refresh_token) {
        await storage.saveRefreshToken(resp.refresh_token);
      }

      const u = resp.user || {};
      const user = {
        id: u.id,
        name: u.display_name,
        email: u.email,
        username: `@${u.username}`,
        bio: u.bio || 'Available',
        avatar: u.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=250',
        isOnline: true,
      };

      setCurrentUser(user);
      await storage.saveUser(user);
      setCurrentScreen('main');
      setActiveTab('chats');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const handleSignOut = async () => {
    const refreshToken = await storage.getRefreshToken();
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => {});
    }
    setCurrentUser(null);
    await storage.clearAuth();
    setRegisterCache({ name: '', email: '', password: '' });
    setActiveConversation(null);
    setCurrentScreen('signin');
  };

  const updateProfile = async ({ name, bio, avatar }) => {
    if (!currentUser) return;
    try {
      const updated = await authApi.updateProfile({ name, bio, avatar });
      const normalized = {
        ...currentUser,
        name: updated.display_name || name || currentUser.name,
        bio: updated.bio || bio || currentUser.bio,
        avatar: updated.avatar_url || avatar || currentUser.avatar,
      };
      setCurrentUser(normalized);
      await storage.saveUser(normalized);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const openConversation = (conv) => {
    setActiveConversation(conv);
    setCurrentScreen('conversation');

    // Fetch conversation message history from server if it has a valid backend ID
    if (conv && conv.id && !conv.id.startsWith('conv_')) {
      chatApi.getMessages(conv.id)
        .then((msgs) => {
          if (Array.isArray(msgs) && msgs.length > 0) {
            const mapped = msgs.map((m) => {
              const d = new Date(m.created_at);
              return {
                id: m.id,
                senderId: m.sender_id,
                text: m.content,
                imageUri: m.media_url || null,
                time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isMe: currentUser ? m.sender_id === currentUser.id : false,
              };
            });
            setMessagesMap((prev) => ({
              ...prev,
              [conv.id]: mapped,
            }));
          }
        })
        .catch(() => {});
    }
  };

  const closeConversation = () => {
    setActiveConversation(null);
    setCurrentScreen('main');
  };

  const startOrGetConversationWithUser = async (user) => {
    const existing = conversations.find((c) => c.user && c.user.id === user.id);
    if (existing) {
      openConversation(existing);
      return;
    }

    // Try creating on server first if recipient has valid UUID
    try {
      const backendConv = await chatApi.createDirectConversation(user.id);
      if (backendConv && backendConv.id) {
        const newConv = {
          id: backendConv.id,
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            bio: 'Hey there!',
            isOnline: user.isOnline,
            lastSeen: user.isOnline ? 'Active now' : 'Offline',
          },
          lastMessage: 'Started conversation',
          time: 'Just now',
          unreadCount: 0,
          pinned: false,
        };
        setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
        openConversation(newConv);
        return;
      }
    } catch (e) {
      console.log('Notice: Fallback to local conversation creation:', e.message);
    }

    const newConv = {
      id: 'conv_' + Date.now(),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        bio: 'Hey there!',
        isOnline: user.isOnline,
        lastSeen: 'Active now',
      },
      lastMessage: 'Started conversation',
      time: 'Just now',
      unreadCount: 0,
      pinned: false,
    };

    setConversations((prev) => [newConv, ...prev]);
    openConversation(newConv);
  };

  const sendMessage = (convId, text, imageUri = null) => {
    if ((!text || !text.trim()) && !imageUri) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: 'm_' + Date.now(),
      senderId: currentUser ? currentUser.id : 'me',
      text: text ? text.trim() : '',
      imageUri: imageUri || null,
      time: timeStr,
      isMe: true,
    };

    // Optimistically add message to UI
    setMessagesMap((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), newMsg],
    }));

    const preview = imageUri ? '📷 Photo' : text.trim();
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, lastMessage: preview, time: timeStr, unreadCount: 0 }
          : c
      )
    );

    // Dispatch via real-time WebSocket store-and-forward queue
    const targetConv = conversations.find((c) => c.id === convId);
    const recipientId = targetConv && targetConv.user ? targetConv.user.id : undefined;

    wsService.sendMessage({
      conversationId: convId,
      recipientId: recipientId,
      content: text ? text.trim() : '',
      mediaUrl: imageUri || '',
    });
  };

  const markStatusViewed = (statusId) => {
    setStatuses((prev) =>
      prev.map((s) => (s.id === statusId ? { ...s, viewed: true } : s))
    );
  };

  const addCallRecord = (user, type) => {
    const newCall = {
      id: 'c_' + Date.now(),
      user: {
        name: user.name,
        avatar: user.avatar,
      },
      type,
      direction: 'outgoing',
      time: 'Just now',
      duration: 'Calling...',
    };
    setCalls((prev) => [newCall, ...prev]);
  };

  const deleteConversation = async (convId) => {
    // Optimistically remove from state
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    setMessagesMap((prev) => {
      const copy = { ...prev };
      delete copy[convId];
      return copy;
    });

    if (activeConversation && activeConversation.id === convId) {
      closeConversation();
    }

    if (!convId.startsWith('conv_')) {
      try {
        await chatApi.deleteConversation(convId);
      } catch (err) {
        console.warn('Failed deleting conversation on backend:', err.message);
      }
    }
  };

  const deleteMessage = async (convId, msgId) => {
    // Optimistically update message or remove
    setMessagesMap((prev) => ({
      ...prev,
      [convId]: (prev[convId] || []).filter((m) => m.id !== msgId),
    }));

    if (!msgId.startsWith('m_')) {
      try {
        await chatApi.deleteMessage(msgId);
      } catch (err) {
        console.warn('Failed deleting message on backend:', err.message);
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        themeMode,
        toggleTheme,
        currentUser,
        isInitializing,
        registerCache,
        currentScreen,
        setCurrentScreen,
        activeTab,
        setActiveTab,
        activeConversation,
        conversations,
        statuses,
        calls,
        messagesMap,
        handleRegisterDetails,
        handleCompleteUsername,
        handleSignIn,
        handleSignOut,
        updateProfile,
        openConversation,
        closeConversation,
        startOrGetConversationWithUser,
        sendMessage,
        deleteConversation,
        deleteMessage,
        markStatusViewed,
        addCallRecord,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
