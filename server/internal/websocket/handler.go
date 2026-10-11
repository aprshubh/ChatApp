package websocket

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"chatapp/server/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow configured origins or all in dev
		return true
	},
}

type Handler struct {
	hub       *Hub
	db        *sql.DB
	jwtConfig config.JWTConfig
}

func NewHandler(hub *Hub, db *sql.DB, jwtConfig config.JWTConfig) *Handler {
	return &Handler{
		hub:       hub,
		db:        db,
		jwtConfig: jwtConfig,
	}
}

// ServeWS authenticates the incoming WebSocket handshake via query token or Bearer header,
// registers the client with the Hub, and begins read/write pumps.
func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	// 1. Authenticate user from query (?token=...) or Authorization header
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if tokenStr == "" {
		http.Error(w, `{"error":"Missing authentication token"}`, http.StatusUnauthorized)
		return
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.jwtConfig.Secret), nil
	})

	if err != nil || !token.Valid {
		http.Error(w, `{"error":"Invalid or expired authentication token"}`, http.StatusUnauthorized)
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		http.Error(w, `{"error":"Invalid token claims"}`, http.StatusUnauthorized)
		return
	}

	userID, _ := claims["sub"].(string)
	username, _ := claims["usr"].(string)
	if userID == "" {
		http.Error(w, `{"error":"Invalid subject in token"}`, http.StatusUnauthorized)
		return
	}

	deviceID := r.URL.Query().Get("device_id")
	if deviceID == "" {
		deviceID = "mobile_default"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade failed: %v", err)
		return
	}

	client := &Client{
		Hub:      h.hub,
		Conn:     conn,
		UserID:   userID,
		Username: username,
		DeviceID: deviceID,
		Send:     make(chan []byte, 256),
	}

	// Register device in PostgreSQL if devices table exists
	if h.db != nil {
		go func(uid, devID string) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_, _ = h.db.ExecContext(ctx, `
				INSERT INTO devices (user_id, device_id, last_active_at)
				VALUES ($1, $2, NOW())
				ON CONFLICT (user_id, device_id) 
				DO UPDATE SET last_active_at = NOW()
			`, uid, devID)
		}(client.UserID, client.DeviceID)
	}

	h.hub.register <- client

	// Start concurrent read & write pumps
	go client.writePump()
	go client.readPump()
}

// readPump receives incoming messages from WebSocket and processes them.
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WebSocket] Read error: %v", err)
			}
			break
		}

		var envelope WSMessage
		if err := json.Unmarshal(messageBytes, &envelope); err != nil {
			c.sendError("INVALID_ENVELOPE", "Malformed message envelope")
			continue
		}

		c.handleIncomingEvent(&envelope)
	}
}

// writePump drains the client's send channel and sends ping heartbeats.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The Hub closed the channel
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Optimize multiple queued messages into a single frame
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleIncomingEvent routes protocol events.
func (c *Client) handleIncomingEvent(msg *WSMessage) {
	switch msg.Type {
	case EventHeartbeatPing:
		pong, _ := NewWSMessage(EventHeartbeatPong, map[string]string{"status": "ok"})
		if pongBytes, err := json.Marshal(pong); err == nil {
			c.Send <- pongBytes
		}

	case EventMessageSend:
		var sendReq SendPayload
		if err := json.Unmarshal(msg.Payload, &sendReq); err != nil {
			c.sendError("INVALID_PAYLOAD", "Failed to decode send payload")
			return
		}
		c.processMessageSend(&sendReq)

	case EventMessageAck:
		var ackReq AckPayload
		if err := json.Unmarshal(msg.Payload, &ackReq); err != nil {
			c.sendError("INVALID_ACK", "Failed to decode ack payload")
			return
		}
		if err := c.Hub.AcknowledgeMessage(c.UserID, ackReq.MessageID, ackReq.ConversationID); err != nil {
			log.Printf("[WebSocket] Ack error: %v", err)
		}

	case EventConnectionResume:
		c.Hub.DeliverPendingMessages(c.UserID, c.DeviceID)

	default:
		c.sendError("UNKNOWN_EVENT", "Unknown event type: "+msg.Type)
	}
}

// processMessageSend stores the message durably in messages & pending_messages, then pushes to recipient.
func (c *Client) processMessageSend(p *SendPayload) {
	if c.Hub.db == nil {
		c.sendError("DB_UNAVAILABLE", "Database is unavailable")
		return
	}

	if strings.TrimSpace(p.Content) == "" && strings.TrimSpace(p.MediaURL) == "" {
		c.sendError("EMPTY_MESSAGE", "Message must contain text or media")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Resolve conversation recipients
	var recipientIDs []string
	if p.RecipientID != "" {
		recipientIDs = append(recipientIDs, p.RecipientID)
	} else if p.ConversationID != "" {
		rows, err := c.Hub.db.QueryContext(ctx, `
			SELECT user_id FROM conversation_members 
			WHERE conversation_id = $1 AND user_id != $2
		`, p.ConversationID, c.UserID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var uID string
				if err := rows.Scan(&uID); err == nil {
					recipientIDs = append(recipientIDs, uID)
				}
			}
		}
	}

	msgType := p.Type
	if msgType == "" {
		msgType = "text"
	}

	// 2. Persist message durably in messages table
	var messageID string
	var createdAt time.Time
	err := c.Hub.db.QueryRowContext(ctx, `
		INSERT INTO messages (conversation_id, sender_id, type, content, media_url, reply_to_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::uuid, NOW(), NOW())
		RETURNING id, created_at
	`, p.ConversationID, c.UserID, msgType, p.Content, p.MediaURL, p.ReplyToID).Scan(&messageID, &createdAt)

	if err != nil {
		log.Printf("[WebSocket] Error inserting message: %v", err)
		c.sendError("SAVE_FAILED", "Failed to persist message")
		return
	}

	// Update conversation's last_message_at
	_, _ = c.Hub.db.ExecContext(ctx, `
		UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1
	`, p.ConversationID)

	deliverData := DeliverPayload{
		MessageID:      messageID,
		ConversationID: p.ConversationID,
		SenderID:       c.UserID,
		SenderUsername: c.Username,
		Type:           msgType,
		Content:        p.Content,
		MediaURL:       p.MediaURL,
		ReplyToID:      p.ReplyToID,
		CreatedAt:      createdAt.Format(time.RFC3339),
	}

	payloadJSON, _ := json.Marshal(deliverData)

	// 3. For each recipient, queue in pending_messages and attempt immediate delivery
	for _, recID := range recipientIDs {
		// Insert into pending_messages queue
		_, qErr := c.Hub.db.ExecContext(ctx, `
			INSERT INTO pending_messages (message_id, conversation_id, sender_id, recipient_id, payload, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (message_id, recipient_id) DO NOTHING
		`, messageID, p.ConversationID, c.UserID, recID, payloadJSON)

		if qErr != nil {
			log.Printf("[Queue] Failed queueing pending message for %s: %v", recID, qErr)
		}

		// Dispatch immediately via WebSocket if recipient is online
		wsMsg, _ := NewWSMessage(EventMessageDeliver, deliverData)
		deliveredCount := c.Hub.SendToUser(recID, wsMsg)

		if deliveredCount > 0 {
			log.Printf("[WebSocket] Dispatched live message %s to user %s (%d devices)", messageID, recID, deliveredCount)
		} else {
			log.Printf("[WebSocket] Recipient %s is offline. Message %s safely retained in pending queue.", recID, messageID)
		}
	}

	// 4. Send confirmation receipt back to sender
	receipt := ReceiptPayload{
		MessageID:      messageID,
		ConversationID: p.ConversationID,
		Status:         "sent",
		Timestamp:      createdAt.Format(time.RFC3339),
	}
	if wsReceipt, err := NewWSMessage(EventMessageReceipt, receipt); err == nil {
		if rBytes, err := json.Marshal(wsReceipt); err == nil {
			c.Send <- rBytes
		}
	}
}

func (c *Client) sendError(code, message string) {
	errPayload := ErrorPayload{Code: code, Message: message}
	if msg, err := NewWSMessage(EventError, errPayload); err == nil {
		if bytes, err := json.Marshal(msg); err == nil {
			c.Send <- bytes
		}
	}
}
