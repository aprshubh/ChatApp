package websocket

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024 // 512 KB
)

// Client represents a connected WebSocket user/device session.
type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	UserID   string
	Username string
	DeviceID string
	Send     chan []byte
}

// Hub manages all active WebSocket connections, message routing, and queue synchronization.
type Hub struct {
	db *sql.DB

	// Registered clients: userID -> map[deviceID]*Client
	clients   map[string]map[string]*Client
	clientsMu sync.RWMutex

	register   chan *Client
	unregister chan *Client
}

func NewHub(db *sql.DB) *Hub {
	return &Hub{
		db:         db,
		clients:    make(map[string]map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clientsMu.Lock()
			if _, exists := h.clients[client.UserID]; !exists {
				h.clients[client.UserID] = make(map[string]*Client)
			}
			h.clients[client.UserID][client.DeviceID] = client
			h.clientsMu.Unlock()

			// Mark user online in DB
			h.setUserOnline(client.UserID, true)

			// Deliver any undelivered messages waiting in queue
			go h.DeliverPendingMessages(client.UserID, client.DeviceID)

		case client := <-h.unregister:
			h.clientsMu.Lock()
			if userClients, exists := h.clients[client.UserID]; exists {
				if _, ok := userClients[client.DeviceID]; ok {
					delete(userClients, client.DeviceID)
					close(client.Send)
				}
				if len(userClients) == 0 {
					delete(h.clients, client.UserID)
					h.setUserOnline(client.UserID, false)
				}
			}
			h.clientsMu.Unlock()
		}
	}
}

// IsUserOnline checks if the user currently has at least one active connection.
func (h *Hub) IsUserOnline(userID string) bool {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()
	return len(h.clients[userID]) > 0
}

func (h *Hub) setUserOnline(userID string, online bool) {
	if h.db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `UPDATE users SET is_online = $1, last_seen_at = NOW() WHERE id = $2`
	_, err := h.db.ExecContext(ctx, query, online, userID)
	if err != nil {
		log.Printf("[Hub] Error updating online status for user %s: %v", userID, err)
	}
}

// SendToUser dispatches a payload to all connected devices of a user. Returns count of delivered devices.
func (h *Hub) SendToUser(userID string, msg *WSMessage) int {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[Hub] Failed marshalling message: %v", err)
		return 0
	}

	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	devices, exists := h.clients[userID]
	if !exists || len(devices) == 0 {
		return 0
	}

	delivered := 0
	for _, client := range devices {
		select {
		case client.Send <- data:
			delivered++
		default:
			log.Printf("[Hub] Client channel full for user %s device %s", userID, client.DeviceID)
		}
	}
	return delivered
}

// DeliverPendingMessages loads unacknowledged messages from pending_messages and pushes them.
func (h *Hub) DeliverPendingMessages(userID string, deviceID string) {
	if h.db == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := h.db.QueryContext(ctx, `
		SELECT pm.id, pm.message_id, pm.conversation_id, pm.sender_id, u.username, pm.payload, pm.created_at
		FROM pending_messages pm
		JOIN users u ON u.id = pm.sender_id
		WHERE pm.recipient_id = $1 AND pm.expires_at > NOW()
		ORDER BY pm.created_at ASC
		LIMIT 100
	`, userID)
	if err != nil {
		log.Printf("[Hub] Error querying pending messages for user %s: %v", userID, err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var queueID, messageID, convID, senderID, senderUsername string
		var rawPayload []byte
		var createdAt time.Time

		if err := rows.Scan(&queueID, &messageID, &convID, &senderID, &senderUsername, &rawPayload, &createdAt); err != nil {
			log.Printf("[Hub] Error scanning pending message: %v", err)
			continue
		}

		var deliver DeliverPayload
		if err := json.Unmarshal(rawPayload, &deliver); err != nil {
			continue
		}

		deliver.MessageID = messageID
		deliver.ConversationID = convID
		deliver.SenderID = senderID
		deliver.SenderUsername = senderUsername
		deliver.CreatedAt = createdAt.Format(time.RFC3339)

		wsMsg, err := NewWSMessage(EventMessageDeliver, deliver)
		if err == nil {
			h.SendToUser(userID, wsMsg)
		}
	}
}

// AcknowledgeMessage validates the ACK and deletes the message from pending_messages (Privacy-first).
func (h *Hub) AcknowledgeMessage(recipientID, messageID, conversationID string) error {
	if h.db == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Delete message from pending queue
	res, err := h.db.ExecContext(ctx, `
		DELETE FROM pending_messages 
		WHERE message_id = $1 AND recipient_id = $2
	`, messageID, recipientID)
	if err != nil {
		return fmt.Errorf("failed deleting pending message: %w", err)
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected > 0 {
		log.Printf("[Queue] Message %s acknowledged by recipient %s and permanently removed from queue", messageID, recipientID)
	}

	// 2. Mark receipt as delivered in message_receipts
	_, _ = h.db.ExecContext(ctx, `
		INSERT INTO message_receipts (message_id, user_id, status, read_at)
		VALUES ($1, $2, 'delivered', NOW())
		ON CONFLICT (message_id, user_id) DO NOTHING
	`, messageID, recipientID)

	// 3. Notify sender that message was delivered
	var senderID string
	err = h.db.QueryRowContext(ctx, `SELECT sender_id FROM messages WHERE id = $1`, messageID).Scan(&senderID)
	if err == nil && senderID != "" {
		receipt := ReceiptPayload{
			MessageID:      messageID,
			ConversationID: conversationID,
			Status:         "delivered",
			Timestamp:      time.Now().Format(time.RFC3339),
		}
		if msg, err := NewWSMessage(EventMessageReceipt, receipt); err == nil {
			h.SendToUser(senderID, msg)
		}
	}

	return nil
}
