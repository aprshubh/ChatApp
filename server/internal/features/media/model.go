package media

type PresignedUploadRequest struct {
	FileName    string `json:"file_name"`
	ContentType string `json:"content_type"`
	SizeBytes   int64  `json:"size_bytes"`
	SHA256Hash  string `json:"sha256_hash"`
}

type PresignedUploadResponse struct {
	StorageKey       string `json:"storage_key"`
	UploadURL        string `json:"upload_url"`
	ExpiresInSeconds int64  `json:"expires_in_seconds"`
}

type PresignedDownloadRequest struct {
	StorageKey string `json:"storage_key"`
}

type PresignedDownloadResponse struct {
	DownloadURL      string `json:"download_url"`
	ExpiresInSeconds int64  `json:"expires_in_seconds"`
}
