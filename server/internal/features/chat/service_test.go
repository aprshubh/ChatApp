package chat_test

import (
	"context"
	"testing"

	"chatapp/server/internal/features/chat"
)

func TestChatServiceWithNilDB(t *testing.T) {
	svc := chat.NewService(nil)

	// Conversations list should return empty slice without error
	convs, err := svc.GetUserConversations(context.Background(), "user-123")
	if err != nil {
		t.Fatalf("unexpected error with nil db: %v", err)
	}
	if len(convs) != 0 {
		t.Fatalf("expected 0 conversations, got %d", len(convs))
	}

	// Messages should return empty slice without error
	msgs, err := svc.GetConversationMessages(context.Background(), "user-123", "conv-123", 10, 0)
	if err != nil {
		t.Fatalf("unexpected error with nil db: %v", err)
	}
	if len(msgs) != 0 {
		t.Fatalf("expected 0 messages, got %d", len(msgs))
	}

	if err := svc.DeleteConversation(context.Background(), "user-123", "conv-123"); err == nil {
		t.Fatalf("expected error for DeleteConversation with nil db")
	}

	if err := svc.DeleteMessage(context.Background(), "user-123", "msg-123"); err == nil {
		t.Fatalf("expected error for DeleteMessage with nil db")
	}
}
