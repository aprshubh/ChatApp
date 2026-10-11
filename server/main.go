package main

import (
	"log"

	"chatapp/server/config"
	"chatapp/server/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	srv := server.New(cfg)
	if err := srv.Start(); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}
