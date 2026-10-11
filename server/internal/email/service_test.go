package email

import (
	"strings"
	"testing"

	"chatapp/server/config"
)

func TestRenderHTML_EscapesUserSuppliedValues(t *testing.T) {
	html, err := renderHTML(verificationTemplate, map[string]string{
		"AppName": "ChatApp", "Username": `<script>alert("x")</script>`,
		"VerifyURL": "https://example.test/verify?token=a&next=b", "Token": "<unsafe>",
	})
	if err != nil {
		t.Fatalf("renderHTML() error = %v", err)
	}
	if strings.Contains(html, "<script>") || !strings.Contains(html, "&lt;script&gt;") {
		t.Fatalf("username was not safely escaped: %s", html)
	}
	if strings.Contains(html, "<unsafe>") || !strings.Contains(html, "&lt;unsafe&gt;") {
		t.Fatalf("token was not safely escaped: %s", html)
	}
}

func TestConsoleProviderOnlyAllowedInDevelopment(t *testing.T) {
	svc := NewService(config.EmailConfig{
		Provider: "console", Environment: "production", From: "noreply@example.test",
	}, "ChatApp")
	if err := svc.SendEmail("person@example.test", "test", "<p>body</p>"); err == nil {
		t.Fatal("expected console provider to be rejected in production")
	}
}

func TestConsoleProviderWorksInDevelopment(t *testing.T) {
	svc := NewService(config.EmailConfig{
		Provider: "console", Environment: "development", From: "noreply@example.test",
	}, "ChatApp")
	if err := svc.SendEmail("person@example.test", "test", "<p>body</p>"); err != nil {
		t.Fatalf("SendEmail() error = %v", err)
	}
}

func TestUnknownProviderReturnsErrorOnSend(t *testing.T) {
	svc := NewService(config.EmailConfig{Provider: "unknown", Environment: "development"}, "ChatApp")
	if err := svc.SendEmail("person@example.test", "test", "body"); err == nil {
		t.Fatal("expected unknown provider configuration to fail")
	}
}
