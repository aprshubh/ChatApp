package storage_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"chatapp/server/config"
	"chatapp/server/internal/storage"
)

func TestStoragePresignedURLs(t *testing.T) {
	cfg := config.StorageConfig{
		Provider:         "minio",
		Endpoint:         "http://localhost:9000",
		BucketName:       "test-bucket",
		Region:           "us-east-1",
		AccessKeyID:      "minioadmin",
		SecretAccessKey:  "minioadmin",
		UsePathStyle:     true,
		PresignedExpires: 15 * time.Minute,
	}

	svc, err := storage.New(cfg)
	if err != nil {
		t.Fatalf("failed to create storage service: %v", err)
	}

	ctx := context.Background()

	// 1. Presigned Upload URL
	uploadURL, err := svc.GeneratePresignedUploadURL(ctx, "media/2026/10/test-file.bin", "application/octet-stream", 15*time.Minute)
	if err != nil {
		t.Fatalf("unexpected error generating presigned upload URL: %v", err)
	}
	if !strings.Contains(uploadURL, "test-bucket") || !strings.Contains(uploadURL, "X-Amz-Signature") {
		t.Errorf("presigned upload URL missing required S3 components: %s", uploadURL)
	}

	// 2. Presigned Download URL
	downloadURL, err := svc.GeneratePresignedDownloadURL(ctx, "media/2026/10/test-file.bin", 15*time.Minute)
	if err != nil {
		t.Fatalf("unexpected error generating presigned download URL: %v", err)
	}
	if !strings.Contains(downloadURL, "test-bucket") || !strings.Contains(downloadURL, "X-Amz-Signature") {
		t.Errorf("presigned download URL missing required S3 components: %s", downloadURL)
	}
}
