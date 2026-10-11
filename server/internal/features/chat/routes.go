package chat

import (
	"net/http"

	"chatapp/server/config"
	"chatapp/server/internal/middleware"
)

func RegisterRoutes(mux *http.ServeMux, h *Handler, jwtConfig config.JWTConfig) {
	// Protected endpoints (require JWT Authorization header)
	authMiddleware := middleware.AuthRequired(jwtConfig)

	mux.Handle("GET /api/v1/chat/conversations", authMiddleware(http.HandlerFunc(h.ListConversations)))
	mux.Handle("POST /api/v1/chat/conversations/direct", authMiddleware(http.HandlerFunc(h.CreateDirectConversation)))
	mux.Handle("POST /api/v1/chat/conversations/group", authMiddleware(http.HandlerFunc(h.CreateGroupConversation)))
	mux.Handle("GET /api/v1/chat/conversations/{id}/messages", authMiddleware(http.HandlerFunc(h.GetConversationMessages)))
	mux.Handle("DELETE /api/v1/chat/conversations/{id}", authMiddleware(http.HandlerFunc(h.DeleteConversation)))
	mux.Handle("DELETE /api/v1/chat/messages/{id}", authMiddleware(http.HandlerFunc(h.DeleteMessage)))
}
