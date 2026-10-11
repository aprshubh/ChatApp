package media

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"chatapp/server/internal/storage"
)

type Handler struct {
	storageSvc storage.Service
}

func NewHandler(storageSvc storage.Service) *Handler {
	return &Handler{storageSvc: storageSvc}
}

// RequestUploadURL generates a presigned PUT URL for client-side encrypted media.
func (h *Handler) RequestUploadURL(w http.ResponseWriter, r *http.Request) {
	if h.storageSvc == nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Storage service is not configured"})
		return
	}

	var req PresignedUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	// 50MB max upload size guard
	maxSize := int64(50 * 1024 * 1024)
	if req.SizeBytes > maxSize {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "File size exceeds 50MB limit"})
		return
	}

	contentType := req.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Generate storage key: media/YYYY/MM/<random-hex>.bin
	now := time.Now().UTC()
	randomHex := randomToken(16)
	storageKey := fmt.Sprintf("media/%04d/%02d/%s.bin", now.Year(), now.Month(), randomHex)

	uploadURL, err := h.storageSvc.GeneratePresignedUploadURL(r.Context(), storageKey, contentType, 15*time.Minute)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed generating upload URL"})
		return
	}

	resp := PresignedUploadResponse{
		StorageKey:       storageKey,
		UploadURL:        uploadURL,
		ExpiresInSeconds: int64((15 * time.Minute).Seconds()),
	}

	respondJSON(w, http.StatusOK, resp)
}

// RequestDownloadURL generates a presigned GET URL for downloading encrypted media.
func (h *Handler) RequestDownloadURL(w http.ResponseWriter, r *http.Request) {
	if h.storageSvc == nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Storage service is not configured"})
		return
	}

	var req PresignedDownloadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	req.StorageKey = strings.TrimSpace(req.StorageKey)
	if req.StorageKey == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "storage_key is required"})
		return
	}

	downloadURL, err := h.storageSvc.GeneratePresignedDownloadURL(r.Context(), req.StorageKey, 15*time.Minute)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed generating download URL"})
		return
	}

	resp := PresignedDownloadResponse{
		DownloadURL:      downloadURL,
		ExpiresInSeconds: int64((15 * time.Minute).Seconds()),
	}

	respondJSON(w, http.StatusOK, resp)
}

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func randomToken(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
