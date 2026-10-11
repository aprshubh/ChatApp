package health

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"chatapp/server/config"
)

type Handler struct {
	cfg *config.Config
	db  *sql.DB
}

func NewHandler(cfg *config.Config, db *sql.DB) *Handler {
	return &Handler{
		cfg: cfg,
		db:  db,
	}
}

func (h *Handler) Check(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	dbStatus := "not connected"
	if h.db != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := h.db.PingContext(ctx); err == nil {
			dbStatus = "connected"
		} else {
			dbStatus = "unreachable"
		}
	}

	resp := Response{
		Status:    "ok",
		App:       h.cfg.App.Name,
		Env:       h.cfg.App.Env,
		Database:  dbStatus,
		Timestamp: time.Now().UTC(),
		Message:   "ChatApp server is healthy and running smoothly",
	}
	_ = json.NewEncoder(w).Encode(resp)
}
