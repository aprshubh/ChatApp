package auth_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"chatapp/server/config"
	"chatapp/server/internal/database"
	"chatapp/server/internal/features/auth"
)

type mockEmailService struct{}

func (m *mockEmailService) SendVerificationEmail(toEmail, username, verificationToken string) error {
	return nil
}

func (m *mockEmailService) SendPasswordResetEmail(toEmail, username, resetToken string) error {
	return nil
}

func (m *mockEmailService) SendEmail(to, subject, htmlBody string) error {
	return nil
}

func TestPostgresAuthLifecycle(t *testing.T) {
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("failed loading config: %v", err)
	}

	db, err := database.Connect(cfg.Database)
	if err != nil {
		t.Skipf("Skipping DB test: PostgreSQL not reachable: %v", err)
		return
	}
	defer db.Close()

	if err := database.RunMigrations(db); err != nil {
		t.Fatalf("migration failed: %v", err)
	}

	mockEmail := &mockEmailService{}
	svc := auth.NewService(db, mockEmail, cfg.JWT)
	ctx := context.Background()

	uniqueSuffix := fmt.Sprintf("%d", time.Now().UnixNano())
	testUsername := fmt.Sprintf("testuser_%s", uniqueSuffix[:8])
	testEmail := fmt.Sprintf("test_%s@example.com", uniqueSuffix[:8])
	testPass := "SuperSecret123"

	// 1. Register User
	regResp, err := svc.Register(ctx, auth.RegisterRequest{
		Username:    testUsername,
		DisplayName: "Test User",
		Email:       testEmail,
		Password:    testPass,
	})
	if err != nil {
		t.Fatalf("Registration failed: %v", err)
	}
	if regResp.User.IsVerified {
		t.Fatal("expected newly registered user to have IsVerified = false")
	}
	if regResp.AccessToken == "" {
		t.Fatal("expected access token in registration response")
	}

	// 2. Login User
	loginResp, err := svc.Login(ctx, auth.LoginRequest{
		Identifier: testUsername,
		Password:   testPass,
	}, "GoTestAgent/1.0", "127.0.0.1")
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if loginResp.RefreshToken == "" {
		t.Fatal("expected refresh token in login response")
	}

	// 3. Refresh Token Rotation
	refreshResp, err := svc.RefreshToken(ctx, loginResp.RefreshToken, "GoTestAgent/1.0", "127.0.0.1")
	if err != nil {
		t.Fatalf("Token refresh failed: %v", err)
	}
	if refreshResp.AccessToken == "" || refreshResp.RefreshToken == "" {
		t.Fatal("expected new token pair upon refresh")
	}

	// 4. Discover User via Search
	searchResults, err := svc.SearchUsers(ctx, testUsername[:6], 10)
	if err != nil {
		t.Fatalf("SearchUsers failed: %v", err)
	}
	found := false
	for _, u := range searchResults {
		if u.Username == testUsername {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected to find %s in search results", testUsername)
	}

	// 5. Discover exact User by @username
	exactUser, err := svc.GetUserByUsername(ctx, "@"+testUsername)
	if err != nil {
		t.Fatalf("GetUserByUsername failed: %v", err)
	}
	if exactUser.Username != testUsername {
		t.Errorf("expected username %s, got %s", testUsername, exactUser.Username)
	}
}
