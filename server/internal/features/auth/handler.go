package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
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

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(req.Email)
	if req.Username == "" || req.Email == "" || strings.TrimSpace(req.Password) == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Username, email, and password are required"})
		return
	}

	if len(req.Password) < 6 {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Password must be at least 6 characters long"})
		return
	}

	resp, err := h.svc.Register(r.Context(), req)
	if err != nil {
		if err == ErrUserAlreadyExists {
			respondJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create account"})
		return
	}

	respondJSON(w, http.StatusCreated, resp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	req.Identifier = strings.TrimSpace(req.Identifier)

	if req.Identifier == "" || strings.TrimSpace(req.Password) == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Identifier (email or username) and password are required"})
		return
	}

	userAgent := r.UserAgent()
	ipAddress := extractIP(r)

	resp, err := h.svc.Login(r.Context(), req, userAgent, ipAddress)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			respondJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
			return
		}
		if errors.Is(err, ErrEmailNotVerified) {
			respondJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to process login"})
		return
	}

	respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	req.RefreshToken = strings.TrimSpace(req.RefreshToken)
	if req.RefreshToken == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "refresh_token is required"})
		return
	}

	userAgent := r.UserAgent()
	ipAddress := extractIP(r)

	resp, err := h.svc.RefreshToken(r.Context(), req.RefreshToken, userAgent, ipAddress)
	if err != nil {
		if err == ErrInvalidToken || err == ErrTokenRevoked {
			respondJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to refresh token"})
		return
	}

	respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var token string
	if r.Method == http.MethodGet {
		token = r.URL.Query().Get("token")
	} else {
		var req VerifyEmailRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			token = req.Token
		}
	}

	token = strings.TrimSpace(token)
	if token == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Verification token is required"})
		return
	}

	user, err := h.svc.VerifyEmail(r.Context(), token)
	if err != nil {
		if err == ErrInvalidToken {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to verify email"})
		return
	}

	// Browser GET friendly response
	if r.Method == http.MethodGet && strings.Contains(r.Header.Get("Accept"), "text/html") {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `<!DOCTYPE html><html><head><title>Verified</title><style>body{font-family:system-ui;text-align:center;padding:50px;background:#f9fafb}.card{background:white;display:inline-block;padding:40px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05)}h1{color:#16a34a}</style></head><body><div class="card"><h1>✓ Email Verified!</h1><p>Congratulations %s, your email address is verified.</p></div></body></html>`, html.EscapeString(user.Username))
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"message": "Email successfully verified",
		"user":    user,
	})
}

func (h *Handler) ResendVerification(w http.ResponseWriter, r *http.Request) {
	var req ResendVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Email is required"})
		return
	}

	err := h.svc.ResendVerification(r.Context(), req.Email)
	if err != nil {
		if err == ErrUserNotFound {
			respondJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		if err == ErrAlreadyVerified {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to resend verification email"})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Verification email resent successfully. Please check your inbox.",
	})
}

// SearchUsers discovers other users via username/name
func (h *Handler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	results, err := h.svc.SearchUsers(r.Context(), query, limit)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Search failed"})
		return
	}

	respondJSON(w, http.StatusOK, results)
}

// GetUserByUsername fetches exact user profile by @username
func (h *Handler) GetUserByUsername(w http.ResponseWriter, r *http.Request) {
	username := r.PathValue("username")
	if username == "" {
		username = r.URL.Query().Get("username")
	}

	user, err := h.svc.GetUserByUsername(r.Context(), username)
	if err != nil {
		if err == ErrUserNotFound {
			respondJSON(w, http.StatusNotFound, map[string]string{"error": "User not found"})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed fetching user"})
		return
	}

	respondJSON(w, http.StatusOK, user)
}

func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	user, err := h.svc.GetUserByID(r.Context(), userID)
	if err != nil {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "User not found"})
		return
	}

	respondJSON(w, http.StatusOK, user)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	var req UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	user, err := h.svc.UpdateProfile(r.Context(), userID, req)
	if err != nil {
		if errors.Is(err, ErrUsernameAlreadyExists) {
			respondJSON(w, http.StatusConflict, map[string]string{"error": ErrUsernameAlreadyExists.Error()})
			return
		}
		if errors.Is(err, ErrUserNotFound) {
			respondJSON(w, http.StatusNotFound, map[string]string{"error": ErrUserNotFound.Error()})
			return
		}
		if strings.Contains(err.Error(), "username must be") || strings.Contains(err.Error(), "username may contain") {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed updating profile"})
		return
	}

	respondJSON(w, http.StatusOK, user)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "refresh_token is required"})
		return
	}

	_ = h.svc.Logout(r.Context(), strings.TrimSpace(req.RefreshToken))
	respondJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (h *Handler) LogoutAll(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		respondJSON(w, http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
		return
	}

	_ = h.svc.LogoutAll(r.Context(), userID)
	respondJSON(w, http.StatusOK, map[string]string{"message": "All sessions terminated"})
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req ForgotPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Email) == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	_ = h.svc.ForgotPassword(r.Context(), req.Email)
	respondJSON(w, http.StatusOK, map[string]string{
		"message": "If this email is registered, a password reset link has been sent.",
	})
}

func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if len(req.NewPassword) < 6 {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Password must be at least 6 characters"})
		return
	}

	err := h.svc.ResetPassword(r.Context(), req.Token, req.NewPassword)
	if err != nil {
		if err == ErrInvalidToken {
			respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid or expired reset token"})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed resetting password"})
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Password reset successfully. You can now login with your new password.",
	})
}

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func extractIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}
	return r.RemoteAddr
}
