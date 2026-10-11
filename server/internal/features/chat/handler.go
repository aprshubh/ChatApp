package chat

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"chatapp/server/internal/middleware"
)

type Handler struct {
	svc Service
}

func NewHandler(svc Service) *Handler {
	return &Handler{svc: svc}
}

// ListConversations returns all conversations for the authenticated user.
func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	convs, err := h.svc.GetUserConversations(r.Context(), userID)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, convs)
}

// CreateDirectConversation starts or retrieves a 1-to-1 conversation with a user.
func (h *Handler) CreateDirectConversation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	var req CreateDirectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	req.RecipientID = strings.TrimSpace(req.RecipientID)
	if req.RecipientID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "recipient_id is required"})
		return
	}

	if req.RecipientID == userID {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Cannot create conversation with yourself"})
		return
	}

	conv, err := h.svc.GetOrCreateDirectConversation(r.Context(), userID, req.RecipientID)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, conv)
}

// CreateGroupConversation creates a new group chat.
func (h *Handler) CreateGroupConversation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Group title is required"})
		return
	}

	conv, err := h.svc.CreateGroupConversation(r.Context(), userID, req)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusCreated, conv)
}

// GetConversationMessages returns message history for a conversation.
func (h *Handler) GetConversationMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	convID := r.PathValue("id")
	if convID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Conversation ID required"})
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	messages, err := h.svc.GetConversationMessages(r.Context(), userID, convID, limit, offset)
	if err != nil {
		if err == ErrUnauthorizedMember {
			respondJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, messages)
}

// DeleteConversation deletes a conversation or removes the user's membership.
func (h *Handler) DeleteConversation(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	convID := r.PathValue("id")
	if convID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Conversation ID required"})
		return
	}

	if err := h.svc.DeleteConversation(r.Context(), userID, convID); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Conversation deleted successfully"})
}

// DeleteMessage deletes/revokes a message sent by the user.
func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	msgID := r.PathValue("id")
	if msgID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Message ID required"})
		return
	}

	if err := h.svc.DeleteMessage(r.Context(), userID, msgID); err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Message deleted successfully"})
}

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
