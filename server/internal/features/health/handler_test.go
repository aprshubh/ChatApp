package health_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"chatapp/server/config"
	"chatapp/server/internal/features/health"
)

func TestHealthCheck(t *testing.T) {
	cfg := &config.Config{
		App: config.AppConfig{
			Name: "ChatAppTest",
			Env:  "test",
		},
	}

	handler := health.NewHandler(cfg, nil)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	handler.Check(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var resp health.Response
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Status != "ok" {
		t.Errorf("expected status 'ok', got '%s'", resp.Status)
	}
	if resp.App != "ChatAppTest" {
		t.Errorf("expected app 'ChatAppTest', got '%s'", resp.App)
	}
}
