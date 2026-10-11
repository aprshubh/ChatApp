package websocket

import (
	"encoding/json"
	"time"
)

// Standard Event Types following Privacy-First Messaging Protocol
const (
	EventMessageSend      = "message.send"      // Client -> Server: Send a message
	EventMessageDeliver   = "message.deliver"   // Server -> Recipient: Deliver queued/live message
	EventMessageAck       = "message.ack"       // Recipient -> Server: Recipient stored message, delete from server queue
	EventMessageReceipt   = "message.receipt"   // Server/Client: Status update (sent, delivered, read)
	EventConnectionResume = "connection.resume" // Client -> Server: Client reconnected, request pending messages
	EventHeartbeatPing    = "heartbeat.ping"    // Client <-> Server
	EventHeartbeatPong    = "heartbeat.pong"    // Client <-> Server
	EventUserPresence     = "user.presence"     // Server -> Client: Online/Offline status
	EventError            = "error"             // Server -> Client: Error feedback
)

// WSMessage represents the outer envelope for all WebSocket communication.
type WSMessage struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Timestamp int64           `json:"timestamp"`
}

// SendPayload is sent by a client to submit a message.
type SendPayload struct {
	ClientMsgID    string `json:"client_msg_id"`             // Client-generated UUID for idempotency
	ConversationID string `json:"conversation_id"`          // Conversation UUID
	RecipientID    string `json:"recipient_id,omitempty"`   // For 1-on-1 direct chat
	Type           string `json:"type"`                     // "text", "image", "file", "audio"
	Content        string `json:"content"`                  // Ciphertext if E2EE, or message content
	MediaURL       string `json:"media_url,omitempty"`      // Encrypted media storage reference
	ReplyToID      string `json:"reply_to_id,omitempty"`    // Optional parent message UUID
}

// DeliverPayload is pushed to the recipient device.
type DeliverPayload struct {
	MessageID      string `json:"message_id"`
	ConversationID string `json:"conversation_id"`
	SenderID       string `json:"sender_id"`
	SenderUsername string `json:"sender_username"`
	Type           string `json:"type"`
	Content        string `json:"content"`
	MediaURL       string `json:"media_url,omitempty"`
	ReplyToID      string `json:"reply_to_id,omitempty"`
	CreatedAt      string `json:"created_at"`
}

// AckPayload is sent by the recipient once message is durably written to local SQLite.
type AckPayload struct {
	MessageID      string `json:"message_id"`
	ConversationID string `json:"conversation_id"`
	DeviceID       string `json:"device_id,omitempty"`
}

// ReceiptPayload carries delivery and read receipt acknowledgements.
type ReceiptPayload struct {
	MessageID      string `json:"message_id"`
	ConversationID string `json:"conversation_id"`
	Status         string `json:"status"` // "delivered" | "read"
	Timestamp      string `json:"timestamp"`
}

// ResumePayload is sent by client on reconnect to flush undelivered messages.
type ResumePayload struct {
	DeviceID      string `json:"device_id"`
	LastMessageID string `json:"last_message_id,omitempty"`
}

// ErrorPayload represents protocol-level errors.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// PresencePayload notifies peers of online/offline status.
type PresencePayload struct {
	UserID   string `json:"user_id"`
	IsOnline bool   `json:"is_online"`
	LastSeen string `json:"last_seen,omitempty"`
}

func NewWSMessage(msgType string, payload any) (*WSMessage, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return &WSMessage{
		Type:      msgType,
		Payload:   data,
		Timestamp: time.Now().UnixMilli(),
	}, nil
}
