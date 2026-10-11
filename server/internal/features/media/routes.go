package media

import "net/http"

func RegisterRoutes(mux *http.ServeMux, h *Handler) {
	mux.HandleFunc("POST /api/v1/media/upload-url", h.RequestUploadURL)
	mux.HandleFunc("POST /api/v1/media/download-url", h.RequestDownloadURL)
}
