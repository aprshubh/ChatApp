package health

import "net/http"

func RegisterRoutes(mux *http.ServeMux, h *Handler) {
	mux.HandleFunc("GET /health", h.Check)
	mux.HandleFunc("GET /api/v1/health", h.Check)
}
