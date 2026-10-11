package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"chatapp/server/config"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Connect initializes and validates a PostgreSQL connection pool.
func Connect(cfg config.DatabaseConfig) (*sql.DB, error) {
	dsn := cfg.DSN()

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Configure connection pooling
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	db.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)

	// Verify the connection with a 10-second timeout (accommodates cloud cold starts)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to ping postgres database: %w", err)
	}

	if cfg.URL != "" {
		log.Println("[Database] Successfully connected to PostgreSQL via DATABASE_URL (Cloud/Neon)")
	} else {
		log.Printf("[Database] Successfully connected to PostgreSQL (%s:%s/%s)\n", cfg.Host, cfg.Port, cfg.Name)
	}
	return db, nil
}

// Ping checks if the database is reachable.
func Ping(db *sql.DB) error {
	if db == nil {
		return fmt.Errorf("database connection is nil")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return db.PingContext(ctx)
}
