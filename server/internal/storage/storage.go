package storage

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"chatapp/server/config"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	smithy "github.com/aws/smithy-go"
)

type Service interface {
	GeneratePresignedUploadURL(ctx context.Context, key string, contentType string, expires time.Duration) (string, error)
	GeneratePresignedDownloadURL(ctx context.Context, key string, expires time.Duration) (string, error)
	DeleteObject(ctx context.Context, key string) error
	EnsureBucketExists(ctx context.Context) error
}

type s3StorageService struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	cfg           config.StorageConfig
}

func New(cfg config.StorageConfig) (Service, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...any) (aws.Endpoint, error) {
		if cfg.Endpoint != "" {
			return aws.Endpoint{
				URL:               cfg.Endpoint,
				HostnameImmutable: true,
				SigningRegion:     cfg.Region,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	awsCfg, err := s3config.LoadDefaultConfig(context.Background(),
		s3config.WithRegion(cfg.Region),
		s3config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
		s3config.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS/S3 config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.UsePathStyle // Required for MinIO / local S3
	})

	presignClient := s3.NewPresignClient(client)

	service := &s3StorageService{
		client:        client,
		presignClient: presignClient,
		cfg:           cfg,
	}

	log.Printf("[Storage] Initialized S3 storage provider (%s) with bucket: %s\n", cfg.Provider, cfg.BucketName)
	return service, nil
}

func (s *s3StorageService) GeneratePresignedUploadURL(ctx context.Context, key string, contentType string, expires time.Duration) (string, error) {
	if expires <= 0 {
		expires = s.cfg.PresignedExpires
	}

	req, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.cfg.BucketName),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = expires
	})
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned upload URL: %w", err)
	}

	return req.URL, nil
}

func (s *s3StorageService) GeneratePresignedDownloadURL(ctx context.Context, key string, expires time.Duration) (string, error) {
	if expires <= 0 {
		expires = s.cfg.PresignedExpires
	}

	req, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.BucketName),
		Key:    aws.String(key),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = expires
	})
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned download URL: %w", err)
	}

	return req.URL, nil
}

func (s *s3StorageService) DeleteObject(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.cfg.BucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete object %s: %w", key, err)
	}
	return nil
}

func (s *s3StorageService) EnsureBucketExists(ctx context.Context) error {
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(s.cfg.BucketName),
	})
	if err == nil {
		return nil // Bucket already exists and is accessible
	}

	var notFound *types.NotFound
	var apiErr smithy.APIError
	if errors.As(err, &notFound) || (errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NotFound" || apiErr.ErrorCode() == "404")) {
		log.Printf("[Storage] Bucket %s not found. Creating bucket...\n", s.cfg.BucketName)
		_, createErr := s.client.CreateBucket(ctx, &s3.CreateBucketInput{
			Bucket: aws.String(s.cfg.BucketName),
		})
		if createErr != nil {
			return fmt.Errorf("failed to create bucket %s: %w", s.cfg.BucketName, createErr)
		}
		log.Printf("[Storage] Bucket %s created successfully!\n", s.cfg.BucketName)
		return nil
	}

	return fmt.Errorf("could not reach storage bucket %s: %w", s.cfg.BucketName, err)
}
