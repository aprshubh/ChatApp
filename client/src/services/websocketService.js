import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WS_BASE_URL } from '../constants/config';
import { storage } from './storageService';
import { sqliteService } from '../database/sqliteService';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.isConnected = false;
    this.deviceId = 'rn_mobile_' + Math.random().toString(36).substring(2, 9);

    // Exponential backoff state
    this.retryCount = 0;
    this.baseDelayMs = 1000;
    this.maxDelayMs = 30000;

    // Mobile lifecycle listeners
    this.isAppInForeground = true;
    this.setupLifecycleListeners();
  }

  setupLifecycleListeners() {
    // 1. AppState: Mobile OS foreground / background transitions
    AppState.addEventListener('change', (nextAppState) => {
      const isForeground = nextAppState === 'active';
      this.isAppInForeground = isForeground;

      if (isForeground) {
        // Foregrounded: Verify connection or reconnect immediately
        if (!this.isConnected) {
          this.retryCount = 0;
          this.connect();
        } else {
          this.startHeartbeat();
        }
      } else {
        // Backgrounded: Stop heartbeat to preserve battery
        this.stopHeartbeat();
      }
    });

    // 2. NetInfo: Network availability transitions
    NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        if (!this.isConnected && this.isAppInForeground) {
          // Network came back online, attempt reconnection with reset backoff
          this.retryCount = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          this.connect();
        }
      }
    });
  }

  async connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = await storage.getToken();
    if (!token) {
      return;
    }

    try {
      const url = `${WS_BASE_URL}?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(this.deviceId)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.retryCount = 0; // Reset exponential backoff on success
        this.startHeartbeat();
        this.emit('connection.state', { connected: true });

        // Request server to deliver any missed events from queue
        this.send('connection.resume', { device_id: this.deviceId });

        // Drain any messages waiting in offline outbox
        this.drainOutbox();
      };

      this.ws.onmessage = async (event) => {
        try {
          const envelope = JSON.parse(event.data);
          await this.handleEvent(envelope);
        } catch (e) {
          console.warn('[WS] Envelope parse or processing error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Socket error event:', err.message || err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('connection.state', { connected: false });
        if (this.isAppInForeground) {
          this.scheduleReconnectWithBackoff();
        }
      };
    } catch (err) {
      console.warn('[WS] Connect failed:', err);
      if (this.isAppInForeground) {
        this.scheduleReconnectWithBackoff();
      }
    }
  }

  /**
   * Core Reliability Contract:
   * 1. Go server -> Phone: Message received
   * 2. Local persistence: Message saved to SQLite
   * 3. Phone -> Go server: ACK dispatched only after SQLite confirms commit
   */
  async handleEvent(envelope) {
    const { type, payload } = envelope;

    if (type === 'message.deliver' && payload) {
      try {
        // Step 2: Durable save in SQLite FIRST
        await sqliteService.saveMessage({
          id: payload.message_id || payload.id,
          conversation_id: payload.conversation_id,
          sender_id: payload.sender_id,
          content: payload.content,
          media_url: payload.media_url,
          reply_to_id: payload.reply_to_id,
          type: payload.type || 'text',
          status: 'delivered',
          created_at: payload.created_at || Date.now(),
        });

        // Also update conversation's last message
        await sqliteService.saveConversation({
          id: payload.conversation_id,
          last_message: payload.content,
          last_message_at: Date.now(),
          unread_count: 1,
        });

        // Step 3: Send ACK back to Go server
        if (payload.message_id) {
          this.sendAck(payload.message_id, payload.conversation_id);
        }
      } catch (dbErr) {
        // CRITICAL: If SQLite write fails, DO NOT ACK so server redelivers later!
        console.error('[WS] SQLite write failed, omitting ACK for safe redelivery:', dbErr);
        return;
      }
    }

    // Server confirmed message received/sent
    if (type === 'message.ack' && payload) {
      if (payload.message_id || payload.client_msg_id) {
        await sqliteService.updateMessageStatus(
          payload.message_id || payload.client_msg_id,
          payload.status || 'sent'
        );
        if (payload.client_msg_id) {
          await sqliteService.removeOutbox(payload.client_msg_id);
        }
      }
    }

    // Notify all UI and cache listeners
    this.emit(type, payload);
    this.emit('*', envelope);
  }

  sendMessage({ conversationId, recipientId, content, mediaUrl, replyToId }) {
    const clientMsgId = `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payload = {
      client_msg_id: clientMsgId,
      conversation_id: conversationId,
      recipient_id: recipientId,
      type: mediaUrl ? 'image' : 'text',
      content: content || '',
      media_url: mediaUrl || '',
      reply_to_id: replyToId || '',
    };

    // Optimistically save to SQLite with status = 'pending'
    sqliteService.saveMessage({
      id: clientMsgId,
      client_msg_id: clientMsgId,
      conversation_id: conversationId,
      sender_id: 'me',
      content,
      media_url: mediaUrl,
      reply_to_id: replyToId,
      type: payload.type,
      status: 'pending',
      created_at: Date.now(),
    });

    const sent = this.send('message.send', payload);
    if (!sent) {
      // Queued into SQLite outbox for offline delivery
      sqliteService.enqueueOutbox(payload);
    }

    return { clientMsgId, queued: !sent };
  }

  async drainOutbox() {
    try {
      const pendingItems = await sqliteService.getPendingOutbox();
      for (const item of pendingItems) {
        const sent = this.send('message.send', {
          client_msg_id: item.client_msg_id,
          conversation_id: item.conversation_id,
          recipient_id: item.recipient_id,
          type: item.media_url ? 'image' : 'text',
          content: item.content,
          media_url: item.media_url,
          reply_to_id: item.reply_to_id,
        });
        if (sent) {
          await sqliteService.removeOutbox(item.client_msg_id);
        }
      }
    } catch (err) {
      console.warn('[WS] Outbox drain failed:', err);
    }
  }

  sendAck(messageId, conversationId) {
    return this.send('message.ack', {
      message_id: messageId,
      conversation_id: conversationId,
      device_id: this.deviceId,
    });
  }

  send(type, payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type,
        payload,
        timestamp: Date.now(),
      }));
      return true;
    } catch (err) {
      console.warn('[WS] Send failed:', err);
      return false;
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.isConnected && this.isAppInForeground) {
        this.send('heartbeat.ping', {});
      }
    }, 45000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Exponential backoff with random jitter to prevent server stampedes
   */
  scheduleReconnectWithBackoff() {
    if (this.reconnectTimer) return;

    this.retryCount++;
    const exponential = Math.min(
      this.baseDelayMs * Math.pow(1.8, this.retryCount),
      this.maxDelayMs
    );
    // Add ±25% random jitter
    const jitter = exponential * (0.75 + Math.random() * 0.5);
    const delay = Math.round(jitter);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.retryCount = 0;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[WS] Listener exception:', e);
        }
      });
    }
  }
}

export const wsService = new WebSocketService();
