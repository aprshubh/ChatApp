package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"chatapp/server/config"
	"chatapp/server/internal/email"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists  = errors.New("user with this email or username already exists")
	ErrInvalidCredentials = errors.New("invalid email/username or password")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrAlreadyVerified    = errors.New("email is already verified")
	ErrTokenRevoked       = errors.New("refresh token has been revoked or expired")
)

type Service interface {
	Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error)
	Login(ctx context.Context, req LoginRequest, userAgent, ipAddress string) (*AuthResponse, error)
	RefreshToken(ctx context.Context, refreshToken, userAgent, ipAddress string) (*AuthResponse, error)
	VerifyEmail(ctx context.Context, token string) (*User, error)
	ResendVerification(ctx context.Context, email string) error
	GetUserByID(ctx context.Context, id string) (*User, error)
	UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (*User, error)
	Logout(ctx context.Context, refreshToken string) error
	LogoutAll(ctx context.Context, userID string) error
	ForgotPassword(ctx context.Context, email string) error
	ResetPassword(ctx context.Context, token, newPassword string) error
	SearchUsers(ctx context.Context, query string, limit int) ([]UserSearchResult, error)
	GetUserByUsername(ctx context.Context, username string) (*UserSearchResult, error)
}

type postgresService struct {
	db       *sql.DB
	emailSvc email.Service
	jwtCfg   config.JWTConfig
}

func NewService(db *sql.DB, emailSvc email.Service, jwtCfg config.JWTConfig) Service {
	return &postgresService{
		db:       db,
		emailSvc: emailSvc,
		jwtCfg:   jwtCfg,
	}
}

func (s *postgresService) Register(ctx context.Context, req RegisterRequest) (*AuthResponse, error) {
	username := strings.ToLower(strings.TrimSpace(req.Username))
	emailAddr := strings.ToLower(strings.TrimSpace(req.Email))
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = req.Username
	}

	// 1. Check if user already exists
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $2)`
	if err := s.db.QueryRowContext(ctx, checkQuery, emailAddr, username).Scan(&exists); err != nil {
		return nil, fmt.Errorf("failed checking existing user: %w", err)
	}
	if exists {
		return nil, ErrUserAlreadyExists
	}

	// 2. Hash password with bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// 3. Insert into users table
	var user User
	var avatarURL, bio sql.NullString
	var lastSeenAt sql.NullTime

	insertUserSQL := `
		INSERT INTO users (username, display_name, email, password_hash, is_verified)
		VALUES ($1, $2, $3, $4, FALSE)
		RETURNING id, username, display_name, email, avatar_url, bio, is_verified, is_online, last_seen_at, created_at;
	`
	err = s.db.QueryRowContext(ctx, insertUserSQL, username, displayName, emailAddr, string(hashedPassword)).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &avatarURL, &bio, &user.IsVerified, &user.IsOnline, &lastSeenAt, &user.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed creating user: %w", err)
	}
	user.AvatarURL = avatarURL.String
	user.Bio = bio.String
	if lastSeenAt.Valid {
		user.LastSeenAt = lastSeenAt.Time
	}

	// 4. Create email verification token
	vToken := generateSecureHex(24)
	vExpires := time.Now().UTC().Add(24 * time.Hour)
	insertVerifySQL := `INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)`
	if _, err := s.db.ExecContext(ctx, insertVerifySQL, user.ID, vToken, vExpires); err != nil {
		log.Printf("[Auth] Warning: could not save verification token: %v", err)
	} else if s.emailSvc != nil {
		go func(toEmail, username, token string) {
			if err := s.emailSvc.SendVerificationEmail(toEmail, username, token); err != nil {
				log.Printf("[Auth] Failed sending verification email: %v", err)
			}
		}(user.Email, user.Username, vToken)
	}

	// 5. Generate initial access token
	accessToken, err := s.generateAccessToken(user.ID, user.Username)
	if err != nil {
		return nil, fmt.Errorf("failed generating access token: %w", err)
	}

	return &AuthResponse{
		AccessToken: accessToken,
		ExpiresIn:   int64(s.jwtCfg.AccessExpiry.Seconds()),
		User:        user,
		Message:     "Registration successful! Please check your email to verify your account.",
	}, nil
}

func (s *postgresService) Login(ctx context.Context, req LoginRequest, userAgent, ipAddress string) (*AuthResponse, error) {
	identifier := strings.ToLower(strings.TrimSpace(req.Identifier))

	query := `
		SELECT id, username, display_name, email, password_hash, avatar_url, bio, is_verified, is_online, last_seen_at, created_at
		FROM users
		WHERE LOWER(email) = $1 OR LOWER(username) = $1;
	`
	var user User
	var passwordHash string
	var avatarURL, bio sql.NullString
	var lastSeenAt sql.NullTime

	err := s.db.QueryRowContext(ctx, query, identifier).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &passwordHash, &avatarURL, &bio, &user.IsVerified, &user.IsOnline, &lastSeenAt, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("database query error: %w", err)
	}

	user.AvatarURL = avatarURL.String
	user.Bio = bio.String
	if lastSeenAt.Valid {
		user.LastSeenAt = lastSeenAt.Time
	}

	// Verify bcrypt password hash
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Generate Access Token (JWT)
	accessToken, err := s.generateAccessToken(user.ID, user.Username)
	if err != nil {
		return nil, fmt.Errorf("failed generating access token: %w", err)
	}

	// Generate Refresh Token & save SHA-256 hash
	refreshTokenRaw := generateSecureHex(32)
	tokenHash := hashSHA256(refreshTokenRaw)
	expiresAt := time.Now().UTC().Add(s.jwtCfg.RefreshExpiry)

	insertRefreshSQL := `
		INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
		VALUES ($1, $2, $3, $4, $5);
	`
	if _, err := s.db.ExecContext(ctx, insertRefreshSQL, user.ID, tokenHash, userAgent, ipAddress, expiresAt); err != nil {
		return nil, fmt.Errorf("failed saving refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshTokenRaw,
		ExpiresIn:    int64(s.jwtCfg.AccessExpiry.Seconds()),
		User:         user,
		Message:      "Login successful",
	}, nil
}

func (s *postgresService) RefreshToken(ctx context.Context, refreshToken, userAgent, ipAddress string) (*AuthResponse, error) {
	tokenHash := hashSHA256(refreshToken)

	query := `
		SELECT r.id, r.user_id, r.is_revoked, r.expires_at, u.username, u.display_name, u.email, u.avatar_url, u.bio, u.is_verified, u.is_online, u.last_seen_at, u.created_at
		FROM refresh_tokens r
		JOIN users u ON u.id = r.user_id
		WHERE r.token_hash = $1;
	`
	var refreshID, userID, username, displayName, emailAddr string
	var isRevoked bool
	var expiresAt time.Time
	var avatarURL, bio sql.NullString
	var isVerified, isOnline bool
	var lastSeenAt sql.NullTime
	var createdAt time.Time

	err := s.db.QueryRowContext(ctx, query, tokenHash).
		Scan(&refreshID, &userID, &isRevoked, &expiresAt, &username, &displayName, &emailAddr, &avatarURL, &bio, &isVerified, &isOnline, &lastSeenAt, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}

	if isRevoked || time.Now().UTC().After(expiresAt) {
		return nil, ErrTokenRevoked
	}

	// Revoke current refresh token (Token Rotation)
	_, _ = s.db.ExecContext(ctx, `UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1`, refreshID)

	// Issue new Access Token and new Refresh Token
	accessToken, err := s.generateAccessToken(userID, username)
	if err != nil {
		return nil, err
	}

	newRefreshRaw := generateSecureHex(32)
	newTokenHash := hashSHA256(newRefreshRaw)
	newExpiresAt := time.Now().UTC().Add(s.jwtCfg.RefreshExpiry)

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
		VALUES ($1, $2, $3, $4, $5);
	`, userID, newTokenHash, userAgent, ipAddress, newExpiresAt)
	if err != nil {
		return nil, err
	}

	user := User{
		ID:          userID,
		Username:    username,
		DisplayName: displayName,
		Email:       emailAddr,
		AvatarURL:   avatarURL.String,
		Bio:         bio.String,
		IsVerified:  isVerified,
		IsOnline:    isOnline,
		CreatedAt:   createdAt,
	}
	if lastSeenAt.Valid {
		user.LastSeenAt = lastSeenAt.Time
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshRaw,
		ExpiresIn:    int64(s.jwtCfg.AccessExpiry.Seconds()),
		User:         user,
		Message:      "Token refreshed successfully",
	}, nil
}

func (s *postgresService) VerifyEmail(ctx context.Context, token string) (*User, error) {
	var userID string
	var expiresAt time.Time

	query := `SELECT user_id, expires_at FROM email_verifications WHERE token = $1`
	if err := s.db.QueryRowContext(ctx, query, token).Scan(&userID, &expiresAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}

	if time.Now().UTC().After(expiresAt) {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM email_verifications WHERE token = $1`, token)
		return nil, ErrInvalidToken
	}

	// Mark user as verified
	updateSQL := `UPDATE users SET is_verified = TRUE WHERE id = $1`
	if _, err := s.db.ExecContext(ctx, updateSQL, userID); err != nil {
		return nil, fmt.Errorf("failed verifying user: %w", err)
	}

	// Delete used token
	_, _ = s.db.ExecContext(ctx, `DELETE FROM email_verifications WHERE token = $1`, token)

	return s.GetUserByID(ctx, userID)
}

func (s *postgresService) ResendVerification(ctx context.Context, emailAddr string) error {
	emailAddr = strings.ToLower(strings.TrimSpace(emailAddr))

	var id, username string
	var isVerified bool
	query := `SELECT id, username, is_verified FROM users WHERE LOWER(email) = $1`
	if err := s.db.QueryRowContext(ctx, query, emailAddr).Scan(&id, &username, &isVerified); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}

	if isVerified {
		return ErrAlreadyVerified
	}

	// Delete existing tokens
	_, _ = s.db.ExecContext(ctx, `DELETE FROM email_verifications WHERE user_id = $1`, id)

	vToken := generateSecureHex(24)
	vExpires := time.Now().UTC().Add(24 * time.Hour)
	insertSQL := `INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)`
	if _, err := s.db.ExecContext(ctx, insertSQL, id, vToken, vExpires); err != nil {
		return err
	}

	if s.emailSvc != nil {
		go func() {
			_ = s.emailSvc.SendVerificationEmail(emailAddr, username, vToken)
		}()
	}

	return nil
}

func (s *postgresService) GetUserByID(ctx context.Context, id string) (*User, error) {
	query := `
		SELECT id, username, display_name, email, avatar_url, bio, is_verified, is_online, last_seen_at, created_at
		FROM users
		WHERE id = $1;
	`
	var user User
	var avatarURL, bio sql.NullString
	var lastSeenAt sql.NullTime

	err := s.db.QueryRowContext(ctx, query, id).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &avatarURL, &bio, &user.IsVerified, &user.IsOnline, &lastSeenAt, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	user.AvatarURL = avatarURL.String
	user.Bio = bio.String
	if lastSeenAt.Valid {
		user.LastSeenAt = lastSeenAt.Time
	}
	return &user, nil
}

// SearchUsers discovers users by username or display name using trigram and prefix search
func (s *postgresService) SearchUsers(ctx context.Context, query string, limit int) ([]UserSearchResult, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	searchTerm := strings.TrimSpace(query)
	if searchTerm == "" {
		return []UserSearchResult{}, nil
	}

	searchSQL := `
		SELECT id, username, display_name, avatar_url, bio, is_online
		FROM users
		WHERE username ILIKE $1 OR display_name ILIKE $1
		ORDER BY 
			CASE WHEN username ILIKE $2 THEN 0 ELSE 1 END,
			username ASC
		LIMIT $3;
	`
	prefixTerm := searchTerm + "%"
	wildcardTerm := "%" + searchTerm + "%"

	rows, err := s.db.QueryContext(ctx, searchSQL, wildcardTerm, prefixTerm, limit)
	if err != nil {
		return nil, fmt.Errorf("failed searching users: %w", err)
	}
	defer rows.Close()

	var results []UserSearchResult
	for rows.Next() {
		var item UserSearchResult
		var avatarURL, bio sql.NullString
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &avatarURL, &bio, &item.IsOnline); err != nil {
			return nil, err
		}
		item.AvatarURL = avatarURL.String
		item.Bio = bio.String
		results = append(results, item)
	}

	if results == nil {
		results = []UserSearchResult{}
	}
	return results, nil
}

// GetUserByUsername discovers an exact user by @username
func (s *postgresService) GetUserByUsername(ctx context.Context, username string) (*UserSearchResult, error) {
	cleanUsername := strings.ToLower(strings.TrimSpace(username))
	cleanUsername = strings.TrimPrefix(cleanUsername, "@")

	query := `
		SELECT id, username, display_name, avatar_url, bio, is_online
		FROM users
		WHERE LOWER(username) = $1;
	`
	var item UserSearchResult
	var avatarURL, bio sql.NullString
	err := s.db.QueryRowContext(ctx, query, cleanUsername).
		Scan(&item.ID, &item.Username, &item.DisplayName, &avatarURL, &bio, &item.IsOnline)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	item.AvatarURL = avatarURL.String
	item.Bio = bio.String
	return &item, nil
}

func (s *postgresService) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (*User, error) {
	updateSQL := `
		UPDATE users
		SET 
			display_name = COALESCE($1, display_name),
			bio = COALESCE($2, bio),
			avatar_url = COALESCE($3, avatar_url),
			updated_at = NOW()
		WHERE id = $4
		RETURNING id, username, display_name, email, avatar_url, bio, is_verified, is_online, last_seen_at, created_at;
	`
	var user User
	var avatarURL, bio sql.NullString
	var lastSeenAt sql.NullTime

	err := s.db.QueryRowContext(ctx, updateSQL, req.DisplayName, req.Bio, req.AvatarURL, userID).
		Scan(&user.ID, &user.Username, &user.DisplayName, &user.Email, &avatarURL, &bio, &user.IsVerified, &user.IsOnline, &lastSeenAt, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed updating profile: %w", err)
	}

	user.AvatarURL = avatarURL.String
	user.Bio = bio.String
	if lastSeenAt.Valid {
		user.LastSeenAt = lastSeenAt.Time
	}
	return &user, nil
}

func (s *postgresService) Logout(ctx context.Context, refreshToken string) error {
	tokenHash := hashSHA256(refreshToken)
	_, err := s.db.ExecContext(ctx, `UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *postgresService) LogoutAll(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1`, userID)
	return err
}

func (s *postgresService) ForgotPassword(ctx context.Context, emailAddr string) error {
	emailAddr = strings.ToLower(strings.TrimSpace(emailAddr))

	var userID, username string
	query := `SELECT id, username FROM users WHERE LOWER(email) = $1`
	err := s.db.QueryRowContext(ctx, query, emailAddr).Scan(&userID, &username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil // Don't leak whether email exists
		}
		return err
	}

	// Delete prior active reset tokens
	_, _ = s.db.ExecContext(ctx, `DELETE FROM password_resets WHERE user_id = $1`, userID)

	token := generateSecureHex(24)
	expiresAt := time.Now().UTC().Add(1 * time.Hour)

	insertSQL := `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`
	if _, err := s.db.ExecContext(ctx, insertSQL, userID, token, expiresAt); err != nil {
		return fmt.Errorf("failed creating password reset token: %w", err)
	}

	if s.emailSvc != nil {
		go func() {
			_ = s.emailSvc.SendPasswordResetEmail(emailAddr, username, token)
		}()
	}

	return nil
}

func (s *postgresService) ResetPassword(ctx context.Context, token, newPassword string) error {
	token = strings.TrimSpace(token)
	var userID string
	var expiresAt time.Time

	query := `SELECT user_id, expires_at FROM password_resets WHERE token = $1`
	err := s.db.QueryRowContext(ctx, query, token).Scan(&userID, &expiresAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrInvalidToken
		}
		return err
	}

	if time.Now().UTC().After(expiresAt) {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM password_resets WHERE token = $1`, token)
		return ErrInvalidToken
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed hashing password: %w", err)
	}

	// Update password
	updateSQL := `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`
	if _, err := s.db.ExecContext(ctx, updateSQL, string(hashedPassword), userID); err != nil {
		return fmt.Errorf("failed updating password: %w", err)
	}

	// Delete used token & revoke all active refresh tokens
	_, _ = s.db.ExecContext(ctx, `DELETE FROM password_resets WHERE token = $1`, token)
	_, _ = s.db.ExecContext(ctx, `UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1`, userID)

	return nil
}

func (s *postgresService) generateAccessToken(userID, username string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"usr": username,
		"exp": time.Now().UTC().Add(s.jwtCfg.AccessExpiry).Unix(),
		"iat": time.Now().UTC().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtCfg.Secret))
}

func generateSecureHex(length int) string {
	b := make([]byte, length)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func hashSHA256(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}
