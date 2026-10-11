package database

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// RunMigrations automatically applies all unapplied SQL migrations.
func RunMigrations(db *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 1. Ensure migrations tracking table exists
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(255) PRIMARY KEY,
		applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
	);`
	if _, err := db.ExecContext(ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// 2. Read migration files
	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var filenames []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			filenames = append(filenames, entry.Name())
		}
	}
	sort.Strings(filenames)

	// 3. Apply each migration in order
	for _, filename := range filenames {
		var exists bool
		checkSQL := `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`
		if err := db.QueryRowContext(ctx, checkSQL, filename).Scan(&exists); err != nil {
			return fmt.Errorf("failed checking migration %s status: %w", filename, err)
		}

		if exists {
			continue // Already applied
		}

		content, err := migrationFiles.ReadFile("migrations/" + filename)
		if err != nil {
			return fmt.Errorf("failed reading migration %s: %w", filename, err)
		}

		log.Printf("[Database Migration] Applying %s...\n", filename)

		// Run migration in a transaction
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", filename, err)
		}

		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed executing migration %s: %w", filename, err)
		}

		insertSQL := `INSERT INTO schema_migrations (version) VALUES ($1)`
		if _, err := tx.ExecContext(ctx, insertSQL, filename); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", filename, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit transaction for %s: %w", filename, err)
		}

		log.Printf("[Database Migration] %s successfully applied!\n", filename)
	}

	return nil
}
