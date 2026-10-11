.PHONY: all build run test tidy clean help env docker-up docker-down

APP_NAME := server
CMD_PATH := ./cmd/server
BIN_DIR := ./bin

all: build

help:
	@echo "Available commands:"
	@echo "  make run         - Run server"
	@echo "  make build       - Build binary into bin/"
	@echo "  make test        - Run tests"
	@echo "  make tidy        - Tidy Go dependencies"
	@echo "  make clean       - Remove built binaries"
	@echo "  make env         - Create .env from .env.example if missing"
	@echo "  make docker-up   - Start PostgreSQL & S3 Storage with Docker"
	@echo "  make docker-down - Stop Docker containers"

env:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example"; else echo ".env already exists"; fi

build:
	@echo "Building $(APP_NAME)..."
	go build -o $(BIN_DIR)/$(APP_NAME) $(CMD_PATH)

run:
	go run $(CMD_PATH)

test:
	go test -v ./...

tidy:
	go mod tidy

docker-up:
	docker compose -f ../docker-compose.yml up -d

docker-down:
	docker compose -f ../docker-compose.yml down

clean:
	@rm -rf $(BIN_DIR) 2>/dev/null || rmdir /s /q bin 2>nul || true
	@echo "Clean completed."
