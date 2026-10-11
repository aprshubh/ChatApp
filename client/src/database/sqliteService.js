import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DB_NAME = 'chatapp.db';

class LocalDatabase {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.isWeb = Platform.OS === 'web';
    // Web fallback in-memory cache to guarantee zero crashes on web previews
    this.webStore = {
      conversations: new Map(),
      messages: new Map(), // keyed by id, values are message objects
      outbox: new Map(),
    };
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      if (this.isWeb) {
        return true;
      }

      try {
        this.db = await SQLite.openDatabaseAsync(DB_NAME);

        // Enable Write-Ahead Logging (WAL) for concurrency & performance
        await this.db.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;

          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            type TEXT,
            is_group INTEGER DEFAULT 0,
            last_message TEXT,
            last_message_at INTEGER,
            unread_count INTEGER DEFAULT 0,
            avatar_url TEXT,
            updated_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            client_msg_id TEXT,
            type TEXT DEFAULT 'text',
            content TEXT,
            media_url TEXT,
            reply_to_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at INTEGER NOT NULL,
            metadata TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_messages_conv_created
          ON messages (conversation_id, created_at DESC);

          CREATE INDEX IF NOT EXISTS idx_messages_client_id
          ON messages (client_msg_id);

          CREATE TABLE IF NOT EXISTS outbox (
            client_msg_id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            recipient_id TEXT,
            content TEXT,
            media_url TEXT,
            reply_to_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at INTEGER,
            retry_count INTEGER DEFAULT 0
          );
        `);

        return true;
      } catch (err) {
        console.warn('[SQLite] Init failed, falling back to memory store:', err);
        this.isWeb = true; // graceful fallback
        return false;
      }
    })();

    return this.initPromise;
  }

  // --- MESSAGES CRUD & PERSISTENCE ---

  /**
   * Durable save of incoming or outgoing message before sending ACK.
   * Uses INSERT OR REPLACE for idempotency and duplicate deduplication.
   */
  async saveMessage(msg) {
    await this.init();

    const normalized = {
      id: msg.id || msg.message_id || msg.client_msg_id,
      conversation_id: msg.conversation_id || msg.conversationId,
      sender_id: msg.sender_id || msg.senderId || 'me',
      client_msg_id: msg.client_msg_id || msg.clientMsgId || null,
      type: msg.type || (msg.media_url ? 'image' : 'text'),
      content: msg.content || '',
      media_url: msg.media_url || msg.mediaUrl || null,
      reply_to_id: msg.reply_to_id || msg.replyToId || null,
      status: msg.status || 'delivered',
      created_at: typeof msg.created_at === 'number'
        ? msg.created_at
        : msg.created_at
        ? new Date(msg.created_at).getTime()
        : Date.now(),
      metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
    };

    if (this.isWeb) {
      this.webStore.messages.set(normalized.id, normalized);
      return normalized;
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO messages (
          id, conversation_id, sender_id, client_msg_id, type, content, media_url, reply_to_id, status, created_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          normalized.conversation_id,
          normalized.sender_id,
          normalized.client_msg_id,
          normalized.type,
          normalized.content,
          normalized.media_url,
          normalized.reply_to_id,
          normalized.status,
          normalized.created_at,
          normalized.metadata,
        ]
      );
      return normalized;
    } catch (err) {
      console.error('[SQLite] saveMessage failed:', err);
      throw err;
    }
  }

  async saveBatchMessages(messages) {
    if (!messages || messages.length === 0) return;
    await this.init();

    for (const msg of messages) {
      await this.saveMessage(msg);
    }
  }

  async getMessages(conversationId, limit = 50, beforeTimestamp = null) {
    await this.init();

    if (this.isWeb) {
      const all = Array.from(this.webStore.messages.values())
        .filter((m) => m.conversation_id === conversationId)
        .filter((m) => (beforeTimestamp ? m.created_at < beforeTimestamp : true))
        .sort((a, b) => a.created_at - b.created_at);
      return all.slice(Math.max(0, all.length - limit));
    }

    try {
      let query = `SELECT * FROM messages WHERE conversation_id = ?`;
      const params = [conversationId];

      if (beforeTimestamp) {
        query += ` AND created_at < ?`;
        params.push(beforeTimestamp);
      }

      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = await this.db.getAllAsync(query, params);
      // Return chronologically (oldest to newest for chat view)
      return rows.reverse();
    } catch (err) {
      console.warn('[SQLite] getMessages failed:', err);
      return [];
    }
  }

  async updateMessageStatus(messageIdOrClientId, status) {
    await this.init();

    if (this.isWeb) {
      const msg = this.webStore.messages.get(messageIdOrClientId);
      if (msg) {
        msg.status = status;
      }
      return;
    }

    try {
      await this.db.runAsync(
        `UPDATE messages SET status = ? WHERE id = ? OR client_msg_id = ?`,
        [status, messageIdOrClientId, messageIdOrClientId]
      );
    } catch (err) {
      console.warn('[SQLite] updateMessageStatus failed:', err);
    }
  }

  // --- CONVERSATIONS ---

  async saveConversation(conv) {
    await this.init();
    const normalized = {
      id: conv.id,
      title: conv.title || conv.name || 'Chat',
      type: conv.type || (conv.is_group ? 'group' : 'direct'),
      is_group: conv.is_group ? 1 : 0,
      last_message: conv.last_message || conv.lastMessage?.content || '',
      last_message_at: conv.last_message_at || (conv.lastMessage?.created_at ? new Date(conv.lastMessage.created_at).getTime() : Date.now()),
      unread_count: conv.unread_count || 0,
      avatar_url: conv.avatar_url || conv.avatar || null,
      updated_at: Date.now(),
    };

    if (this.isWeb) {
      this.webStore.conversations.set(normalized.id, normalized);
      return normalized;
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO conversations (
          id, title, type, is_group, last_message, last_message_at, unread_count, avatar_url, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalized.id,
          normalized.title,
          normalized.type,
          normalized.is_group,
          normalized.last_message,
          normalized.last_message_at,
          normalized.unread_count,
          normalized.avatar_url,
          normalized.updated_at,
        ]
      );
      return normalized;
    } catch (err) {
      console.warn('[SQLite] saveConversation failed:', err);
    }
  }

  async getConversations() {
    await this.init();

    if (this.isWeb) {
      return Array.from(this.webStore.conversations.values())
        .sort((a, b) => b.last_message_at - a.last_message_at);
    }

    try {
      return await this.db.getAllAsync(
        `SELECT * FROM conversations ORDER BY last_message_at DESC`
      );
    } catch (err) {
      console.warn('[SQLite] getConversations failed:', err);
      return [];
    }
  }

  // --- OUTBOX / OFFLINE QUEUE ---

  async enqueueOutbox(item) {
    await this.init();
    const clientMsgId = item.client_msg_id || `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (this.isWeb) {
      this.webStore.outbox.set(clientMsgId, { ...item, client_msg_id: clientMsgId, status: 'pending', retry_count: 0 });
      return clientMsgId;
    }

    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO outbox (
          client_msg_id, conversation_id, recipient_id, content, media_url, reply_to_id, status, created_at, retry_count
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0)`,
        [
          clientMsgId,
          item.conversation_id,
          item.recipient_id || null,
          item.content || '',
          item.media_url || null,
          item.reply_to_id || null,
          Date.now(),
        ]
      );
      return clientMsgId;
    } catch (err) {
      console.warn('[SQLite] enqueueOutbox failed:', err);
      return clientMsgId;
    }
  }

  async getPendingOutbox() {
    await this.init();

    if (this.isWeb) {
      return Array.from(this.webStore.outbox.values()).filter((o) => o.status === 'pending');
    }

    try {
      return await this.db.getAllAsync(
        `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC`
      );
    } catch (err) {
      console.warn('[SQLite] getPendingOutbox failed:', err);
      return [];
    }
  }

  async removeOutbox(clientMsgId) {
    await this.init();

    if (this.isWeb) {
      this.webStore.outbox.delete(clientMsgId);
      return;
    }

    try {
      await this.db.runAsync(`DELETE FROM outbox WHERE client_msg_id = ?`, [clientMsgId]);
    } catch (err) {
      console.warn('[SQLite] removeOutbox failed:', err);
    }
  }

  async clearAll() {
    await this.init();
    if (this.isWeb) {
      this.webStore.conversations.clear();
      this.webStore.messages.clear();
      this.webStore.outbox.clear();
      return;
    }

    try {
      await this.db.execAsync(`
        DELETE FROM messages;
        DELETE FROM conversations;
        DELETE FROM outbox;
      `);
    } catch (e) {
      console.warn('[SQLite] clearAll failed:', e);
    }
  }
}

export const sqliteService = new LocalDatabase();
