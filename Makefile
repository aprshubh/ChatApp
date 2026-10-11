.PHONY: all build run test tidy clean help docker-up docker-down

all: build

help:
	@echo "ChatApp Root Makefile"
	@echo "  make run         - Run the Go server"
	@echo "  make build       - Build the Go server"
	@echo "  make test        - Run all tests"
	@echo "  make tidy        - Tidy Go dependencies"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make docker-up   - Start PostgreSQL container"
	@echo "  make docker-down - Stop PostgreSQL container"

build:
	$(MAKE) -C server build

run:
	$(MAKE) -C server run

test:
	$(MAKE) -C server test

tidy:
	$(MAKE) -C server tidy

docker-up:
	docker compose up -d

docker-down:
	docker compose down

clean:
	$(MAKE) -C server clean
