package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"chatapp/server/config"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	UserIDKey   contextKey = "user_id"
	UsernameKey contextKey = "username"
)

// AuthRequired ensures request has a valid Bearer JWT access token
func AuthRequired(jwtCfg config.JWTConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				respondAuthError(w, "Authorization header missing")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				respondAuthError(w, "Invalid Authorization header format. Expected 'Bearer <token>'")
				return
			}

			tokenStr := strings.TrimSpace(parts[1])
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(jwtCfg.Secret), nil
			})

			if err != nil || !token.Valid {
				respondAuthError(w, "Invalid or expired access token")
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				respondAuthError(w, "Invalid token claims")
				return
			}

			userID, _ := claims["sub"].(string)
			username, _ := claims["usr"].(string)
			if userID == "" {
				respondAuthError(w, "Invalid subject in token")
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			ctx = context.WithValue(ctx, UsernameKey, username)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID retrieves the authenticated user ID from context
func GetUserID(ctx context.Context) string {
	if val, ok := ctx.Value(UserIDKey).(string); ok {
		return val
	}
	return ""
}

// GetUsername retrieves the authenticated username from context
func GetUsername(ctx context.Context) string {
	if val, ok := ctx.Value(UsernameKey).(string); ok {
		return val
	}
	return ""
}

func respondAuthError(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   "Unauthorized",
		"message": msg,
	})
}
