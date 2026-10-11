package chat

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

var (
	ErrRoomNotFound         = errors.New("chat conversation not found")
	ErrInvalidRoom          = errors.New("invalid conversation title")
	ErrUnauthorizedMember   = errors.New("user is not a member of this conversation")
	ErrRecipientNotFound    = errors.New("recipient user not found")
)

type ConversationSummary struct {
	ID            string    `json:"id"`
	Type          string    `json:"type"` // "direct" | "group"
	Title         string    `json:"title"`
	AvatarURL     string    `json:"avatar_url"`
	LastMessage   string    `json:"last_message"`
	LastMessageAt time.Time `json:"last_message_at"`
	UnreadCount   int       `json:"unread_count"`
	Recipient     *UserPeer `json:"recipient,omitempty"`
}

type UserPeer struct {
	ID          string    `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url"`
	IsOnline    bool      `json:"is_online"`
	LastSeenAt  time.Time `json:"last_seen_at"`
}

type MessageItem struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	SenderID       string    `json:"sender_id"`
	SenderUsername string    `json:"sender_username"`
	Type           string    `json:"type"`
	Content        string    `json:"content"`
	MediaURL       string    `json:"media_url,omitempty"`
	ReplyToID      *string   `json:"reply_to_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type CreateDirectRequest struct {
	RecipientID string `json:"recipient_id"`
}

type CreateGroupRequest struct {
	Title      string   `json:"title"`
	MemberIDs  []string `json:"member_ids"`
}

type Service interface {
	GetUserConversations(ctx context.Context, userID string) ([]ConversationSummary, error)
	GetOrCreateDirectConversation(ctx context.Context, userID, recipientID string) (*ConversationSummary, error)
	CreateGroupConversation(ctx context.Context, userID string, req CreateGroupRequest) (*ConversationSummary, error)
	GetConversationMessages(ctx context.Context, userID, conversationID string, limit, offset int) ([]MessageItem, error)
	DeleteConversation(ctx context.Context, userID, conversationID string) error
	DeleteMessage(ctx context.Context, userID, messageID string) error
}

type pgChatService struct {
	db *sql.DB
}

func NewService(db *sql.DB) Service {
	return &pgChatService{db: db}
}

// GetUserConversations fetches all active direct/group conversations for a user.
func (s *pgChatService) GetUserConversations(ctx context.Context, userID string) ([]ConversationSummary, error) {
	if s.db == nil {
		return []ConversationSummary{}, nil
	}

	query := `
		SELECT 
			c.id, c.type, COALESCE(c.title, ''), COALESCE(c.avatar_url, ''), c.last_message_at,
			COALESCE(
				(SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
				''
			) as last_msg,
			COALESCE(
				(SELECT COUNT(*) FROM pending_messages WHERE conversation_id = c.id AND recipient_id = $1),
				0
			) as unread_count
		FROM conversations c
		JOIN conversation_members cm ON cm.conversation_id = c.id
		WHERE cm.user_id = $1
		ORDER BY c.last_message_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed fetching conversations: %w", err)
	}
	defer rows.Close()

	var result []ConversationSummary
	for rows.Next() {
		var cs ConversationSummary
		if err := rows.Scan(&cs.ID, &cs.Type, &cs.Title, &cs.AvatarURL, &cs.LastMessageAt, &cs.LastMessage, &cs.UnreadCount); err != nil {
			return nil, err
		}

		// If direct chat, populate recipient user details
		if cs.Type == "direct" {
			peerQuery := `
				SELECT u.id, u.username, u.display_name, COALESCE(u.avatar_url, ''), u.is_online, u.last_seen_at
				FROM conversation_members cm
				JOIN users u ON u.id = cm.user_id
				WHERE cm.conversation_id = $1 AND cm.user_id != $2
				LIMIT 1
			`
			var peer UserPeer
			err := s.db.QueryRowContext(ctx, peerQuery, cs.ID, userID).Scan(
				&peer.ID, &peer.Username, &peer.DisplayName, &peer.AvatarURL, &peer.IsOnline, &peer.LastSeenAt,
			)
			if err == nil {
				cs.Recipient = &peer
				if cs.Title == "" {
					cs.Title = peer.DisplayName
				}
				if cs.AvatarURL == "" {
					cs.AvatarURL = peer.AvatarURL
				}
			}
		}

		result = append(result, cs)
	}

	if result == nil {
		result = []ConversationSummary{}
	}
	return result, nil
}

// GetOrCreateDirectConversation looks up an existing 1-on-1 direct conversation or creates one.
func (s *pgChatService) GetOrCreateDirectConversation(ctx context.Context, userID, recipientID string) (*ConversationSummary, error) {
	if s.db == nil {
		return nil, errors.New("database unavailable")
	}

	// 1. Check if direct conversation already exists between these 2 users
	findQuery := `
		SELECT c.id 
		FROM conversations c
		JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
		JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
		WHERE c.type = 'direct'
		LIMIT 1
	`
	var convID string
	err := s.db.QueryRowContext(ctx, findQuery, userID, recipientID).Scan(&convID)
	if err == nil && convID != "" {
		// Existing conversation found, fetch details
		convs, err := s.GetUserConversations(ctx, userID)
		if err == nil {
			for _, c := range convs {
				if c.ID == convID {
					return &c, nil
				}
			}
		}
	}

	// 2. Otherwise create a new direct conversation in a transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	createConvSQL := `
		INSERT INTO conversations (type, created_by, last_message_at, created_at, updated_at)
		VALUES ('direct', $1, NOW(), NOW(), NOW())
		RETURNING id
	`
	err = tx.QueryRowContext(ctx, createConvSQL, userID).Scan(&convID)
	if err != nil {
		return nil, fmt.Errorf("failed creating direct conversation: %w", err)
	}

	// Add both members
	memberSQL := `
		INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
		VALUES ($1, $2, 'member', NOW()), ($1, $3, 'member', NOW())
	`
	if _, err := tx.ExecContext(ctx, memberSQL, convID, userID, recipientID); err != nil {
		return nil, fmt.Errorf("failed adding conversation members: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Fetch recipient info
	var peer UserPeer
	peerSQL := `SELECT id, username, display_name, COALESCE(avatar_url, ''), is_online, last_seen_at FROM users WHERE id = $1`
	_ = s.db.QueryRowContext(ctx, peerSQL, recipientID).Scan(
		&peer.ID, &peer.Username, &peer.DisplayName, &peer.AvatarURL, &peer.IsOnline, &peer.LastSeenAt,
	)

	return &ConversationSummary{
		ID:            convID,
		Type:          "direct",
		Title:         peer.DisplayName,
		AvatarURL:     peer.AvatarURL,
		LastMessage:   "Started conversation",
		LastMessageAt: time.Now(),
		Recipient:     &peer,
	}, nil
}

// CreateGroupConversation creates a multi-member group chat.
func (s *pgChatService) CreateGroupConversation(ctx context.Context, userID string, req CreateGroupRequest) (*ConversationSummary, error) {
	if s.db == nil {
		return nil, errors.New("database unavailable")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var convID string
	createSQL := `
		INSERT INTO conversations (type, title, created_by, last_message_at, created_at, updated_at)
		VALUES ('group', $1, $2, NOW(), NOW(), NOW())
		RETURNING id
	`
	err = tx.QueryRowContext(ctx, createSQL, req.Title, userID).Scan(&convID)
	if err != nil {
		return nil, fmt.Errorf("failed creating group: %w", err)
	}

	// Add creator as owner
	_, err = tx.ExecContext(ctx, `
		INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
		VALUES ($1, $2, 'owner', NOW())
	`, convID, userID)
	if err != nil {
		return nil, err
	}

	// Add members
	for _, mID := range req.MemberIDs {
		if mID == userID {
			continue
		}
		_, _ = tx.ExecContext(ctx, `
			INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
			VALUES ($1, $2, 'member', NOW())
			ON CONFLICT DO NOTHING
		`, convID, mID)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &ConversationSummary{
		ID:            convID,
		Type:          "group",
		Title:         req.Title,
		LastMessage:   "Group created",
		LastMessageAt: time.Now(),
	}, nil
}

// GetConversationMessages fetches chronological messages for a conversation, verifying membership.
func (s *pgChatService) GetConversationMessages(ctx context.Context, userID, conversationID string, limit, offset int) ([]MessageItem, error) {
	if s.db == nil {
		return []MessageItem{}, nil
	}

	// 1. Verify membership
	var isMember bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2)`
	if err := s.db.QueryRowContext(ctx, checkQuery, conversationID, userID).Scan(&isMember); err != nil || !isMember {
		return nil, ErrUnauthorizedMember
	}

	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := `
		SELECT m.id, m.conversation_id, m.sender_id, u.username, m.type, m.content, COALESCE(m.media_url, ''), m.reply_to_id, m.created_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = $1 AND m.is_deleted = FALSE
		ORDER BY m.created_at ASC
		LIMIT $2 OFFSET $3
	`

	rows, err := s.db.QueryContext(ctx, query, conversationID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed fetching messages: %w", err)
	}
	defer rows.Close()

	var items []MessageItem
	for rows.Next() {
		var item MessageItem
		var replyTo sql.NullString
		if err := rows.Scan(
			&item.ID, &item.ConversationID, &item.SenderID, &item.SenderUsername,
			&item.Type, &item.Content, &item.MediaURL, &replyTo, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if replyTo.Valid {
			item.ReplyToID = &replyTo.String
		}
		items = append(items, item)
	}

	if items == nil {
		items = []MessageItem{}
	}
	return items, nil
}

// DeleteConversation removes the user from the conversation or deletes it if 1-to-1 or creator.
func (s *pgChatService) DeleteConversation(ctx context.Context, userID, conversationID string) error {
	if s.db == nil {
		return errors.New("database unavailable")
	}

	// Delete membership or entire conversation
	query := `DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`
	_, err := s.db.ExecContext(ctx, query, conversationID, userID)
	if err != nil {
		return fmt.Errorf("failed deleting conversation: %w", err)
	}

	// If no members remain in this conversation, delete the conversation completely
	_, _ = s.db.ExecContext(ctx, `
		DELETE FROM conversations 
		WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = $1)
	`, conversationID)

	return nil
}

// DeleteMessage soft deletes or removes a message authored by the user.
func (s *pgChatService) DeleteMessage(ctx context.Context, userID, messageID string) error {
	if s.db == nil {
		return errors.New("database unavailable")
	}

	query := `UPDATE messages SET is_deleted = TRUE, content = 'This message was deleted' WHERE id = $1 AND sender_id = $2`
	res, err := s.db.ExecContext(ctx, query, messageID, userID)
	if err != nil {
		return fmt.Errorf("failed deleting message: %w", err)
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return errors.New("message not found or you are not authorized to delete it")
	}

	return nil
}
