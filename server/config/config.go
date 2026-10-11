package config

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App      AppConfig
	Server   ServerConfig
	CORS     CORSConfig
	Database DatabaseConfig
	Email    EmailConfig
	Storage  StorageConfig
	JWT      JWTConfig
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type StorageConfig struct {
	Provider         string
	Endpoint         string
	BucketName       string
	Region           string
	AccessKeyID      string
	SecretAccessKey  string
	UsePathStyle     bool
	PresignedExpires time.Duration
}

type EmailConfig struct {
	ResendAPIKey string
	From         string
	AppURL       string
}

type AppConfig struct {
	Name string
	Env  string
}

type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type CORSConfig struct {
	AllowedOrigins []string
}

type DatabaseConfig struct {
	Host            string
	Port            string
	User            string
	Password        string
	Name            string
	SSLMode         string
	URL             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

// DSN returns the PostgreSQL connection string.
func (d *DatabaseConfig) DSN() string {
	if d.URL != "" {
		return d.URL
	}

	// Format: postgres://user:password@host:port/dbname?sslmode=disable
	userInfo := url.UserPassword(d.User, d.Password)
	dsn := fmt.Sprintf("postgres://%s@%s:%s/%s?sslmode=%s",
		userInfo.String(),
		d.Host,
		d.Port,
		d.Name,
		d.SSLMode,
	)
	return dsn
}

// Load reads configuration from environment variables and an optional .env file.
func Load() (*Config, error) {
	// Attempt to load .env file if it exists, ignore if not present
	if err := godotenv.Load(); err != nil {
		if !os.IsNotExist(err) {
			log.Printf("[Config] Notice: .env file not loaded (%v), using system environment variables", err)
		}
	} else {
		log.Println("[Config] Loaded environment variables from .env file")
	}

	cfg := &Config{
		App: AppConfig{
			Name: getEnv("APP_NAME", "ChatApp"),
			Env:  getEnv("ENV", "development"),
		},
		Server: ServerConfig{
			Port:         getEnv("PORT", "8080"),
			ReadTimeout:  getEnvAsDuration("READ_TIMEOUT", 15*time.Second),
			WriteTimeout: getEnvAsDuration("WRITE_TIMEOUT", 15*time.Second),
			IdleTimeout:  getEnvAsDuration("IDLE_TIMEOUT", 60*time.Second),
		},
		CORS: CORSConfig{
			AllowedOrigins: getEnvAsSlice("CORS_ALLOWED_ORIGINS", []string{"*"}),
		},
		Database: DatabaseConfig{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnv("DB_PORT", "5432"),
			User:            getEnv("DB_USER", "postgres"),
			Password:        getEnv("DB_PASSWORD", "postgres"),
			Name:            getEnv("DB_NAME", "chatapp"),
			SSLMode:         getEnv("DB_SSLMODE", "disable"),
			URL:             getEnv("DATABASE_URL", ""),
			MaxOpenConns:    getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvAsInt("DB_MAX_IDLE_CONNS", 25),
			ConnMaxLifetime: getEnvAsDuration("DB_CONN_MAX_LIFETIME", 15*time.Minute),
			ConnMaxIdleTime: getEnvAsDuration("DB_CONN_MAX_IDLE_TIME", 5*time.Minute),
		},
		Email: EmailConfig{
			ResendAPIKey: getEnv("RESEND_API_KEY", ""),
			From:         getEnv("EMAIL_FROM", "onboarding@resend.dev"),
			AppURL:       getEnv("APP_URL", "http://localhost:8080"),
		},
		Storage: StorageConfig{
			Provider:         getEnv("STORAGE_PROVIDER", "minio"),
			Endpoint:         getEnv("STORAGE_ENDPOINT", "http://localhost:9000"),
			BucketName:       getEnv("STORAGE_BUCKET_NAME", "chatapp-media-encrypted"),
			Region:           getEnv("STORAGE_REGION", "us-east-1"),
			AccessKeyID:      getEnv("STORAGE_ACCESS_KEY_ID", "minioadmin"),
			SecretAccessKey:  getEnv("STORAGE_SECRET_ACCESS_KEY", "minioadmin"),
			UsePathStyle:     getEnvAsBool("STORAGE_USE_PATH_STYLE", true),
			PresignedExpires: getEnvAsDuration("STORAGE_PRESIGNED_URL_EXPIRES", 15*time.Minute),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", "supersecretjwtkey_changeinproduction_12345"),
			AccessExpiry:  getEnvAsDuration("JWT_ACCESS_EXPIRY", 15*time.Minute),
			RefreshExpiry: getEnvAsDuration("JWT_REFRESH_EXPIRY", 30*24*time.Hour),
		},
	}

	return cfg, nil
}

func getEnvAsBool(key string, defaultVal bool) bool {
	valStr := getEnv(key, "")
	if valStr == "" {
		return defaultVal
	}
	b, err := strconv.ParseBool(valStr)
	if err != nil {
		return defaultVal
	}
	return b
}

func getEnv(key, defaultVal string) string {
	if val, exists := os.LookupEnv(key); exists && strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return defaultVal
}

func getEnvAsInt(key string, defaultVal int) int {
	valStr := getEnv(key, "")
	if valStr == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(valStr)
	if err != nil {
		log.Printf("[Config] Warning: invalid integer for %s=%s, using default %d", key, valStr, defaultVal)
		return defaultVal
	}
	return i
}

func getEnvAsDuration(key string, defaultVal time.Duration) time.Duration {
	valStr := getEnv(key, "")
	if valStr == "" {
		return defaultVal
	}
	d, err := time.ParseDuration(valStr)
	if err != nil {
		log.Printf("[Config] Warning: invalid duration for %s=%s, using default %v", key, valStr, defaultVal)
		return defaultVal
	}
	return d
}

func getEnvAsSlice(key string, defaultVal []string) []string {
	valStr := getEnv(key, "")
	if valStr == "" {
		return defaultVal
	}
	parts := strings.Split(valStr, ",")
	var result []string
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return defaultVal
	}
	return result
}
