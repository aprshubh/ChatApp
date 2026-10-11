package auth

import (
	"net/http"

	"chatapp/server/config"
	"chatapp/server/internal/middleware"
)

func RegisterRoutes(mux *http.ServeMux, h *Handler, jwtCfg config.JWTConfig) {
	// Public Auth Routes
	mux.HandleFunc("POST /api/v1/auth/register", h.Register)
	mux.HandleFunc("POST /api/v1/auth/login", h.Login)
	mux.HandleFunc("POST /api/v1/auth/refresh", h.Refresh)
	mux.HandleFunc("POST /api/v1/auth/logout", h.Logout)
	mux.HandleFunc("GET /api/v1/auth/verify", h.VerifyEmail)
	mux.HandleFunc("POST /api/v1/auth/verify", h.VerifyEmail)
	mux.HandleFunc("POST /api/v1/auth/resend-verification", h.ResendVerification)
	mux.HandleFunc("POST /api/v1/auth/forgot-password", h.ForgotPassword)
	mux.HandleFunc("POST /api/v1/auth/reset-password", h.ResetPassword)

	// User Discovery & Profile Lookup
	mux.HandleFunc("GET /api/v1/users/search", h.SearchUsers)
	mux.HandleFunc("GET /api/v1/users/{username}", h.GetUserByUsername)

	// Protected Routes (JWT required)
	authMW := middleware.AuthRequired(jwtCfg)
	mux.Handle("GET /api/v1/auth/me", authMW(http.HandlerFunc(h.GetMe)))
	mux.Handle("PUT /api/v1/auth/me", authMW(http.HandlerFunc(h.UpdateProfile)))
	mux.Handle("POST /api/v1/auth/logout-all", authMW(http.HandlerFunc(h.LogoutAll)))
}
