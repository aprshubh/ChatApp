package server

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"chatapp/server/config"
	"chatapp/server/internal/database"
	"chatapp/server/internal/email"
	"chatapp/server/internal/features/auth"
	"chatapp/server/internal/features/chat"
	"chatapp/server/internal/features/health"
	"chatapp/server/internal/features/media"
	"chatapp/server/internal/middleware"
	"chatapp/server/internal/storage"
	"chatapp/server/internal/websocket"
)

type Server struct {
	cfg        *config.Config
	db         *sql.DB
	hub        *websocket.Hub
	httpServer *http.Server
}

func New(cfg *config.Config) *Server {
	// Initialize PostgreSQL connection & run migrations
	db, err := database.Connect(cfg.Database)
	if err != nil {
		log.Printf("[Database] Notice: PostgreSQL is currently unreachable (%v). The server will start, but database-dependent features will require PostgreSQL to be running.\n", err)
	} else {
		if err := database.RunMigrations(db); err != nil {
			log.Printf("[Database Migration] Warning: Failed applying migrations: %v\n", err)
		}
	}

	mux := http.NewServeMux()

	// Initialize WebSocket Hub & run routing loop
	hub := websocket.NewHub(db)
	go hub.Run()
	wsHandler := websocket.NewHandler(hub, db, cfg.JWT)

	// Initialize Services & Handlers
	emailSvc := email.NewService(cfg.Email, cfg.App.Name)
	storageSvc, err := storage.New(cfg.Storage)
	if err != nil {
		log.Printf("[Storage] Warning: Failed to initialize storage service: %v\n", err)
	} else {
		// Non-blocking bucket check/creation
		go func() {
			if bErr := storageSvc.EnsureBucketExists(context.Background()); bErr != nil {
				log.Printf("[Storage] Notice: %v (Ensure S3 container is running)\n", bErr)
			}
		}()
	}

	healthHandler := health.NewHandler(cfg, db)
	authService := auth.NewService(db, emailSvc, cfg.JWT)
	authHandler := auth.NewHandler(authService)
	chatService := chat.NewService(db)
	chatHandler := chat.NewHandler(chatService)
	mediaHandler := media.NewHandler(storageSvc)

	// Register Feature Routes
	health.RegisterRoutes(mux, healthHandler)
	auth.RegisterRoutes(mux, authHandler, cfg.JWT)
	chat.RegisterRoutes(mux, chatHandler, cfg.JWT)
	media.RegisterRoutes(mux, mediaHandler)

	// WebSocket endpoint
	mux.HandleFunc("/ws", wsHandler.ServeWS)

	// Root welcome endpoint
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"app":"%s","version":"1.0.0","message":"ChatApp Server API is ready"}`+"\n", cfg.App.Name)
	})

	// Wrap Mux with Middleware stack: Recovery -> Logger -> CORS
	handler := middleware.CORS(cfg.CORS.AllowedOrigins)(mux)
	handler = middleware.Logger(handler)
	handler = middleware.Recovery(handler)

	httpServer := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      handler,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	return &Server{
		cfg:        cfg,
		db:         db,
		httpServer: httpServer,
	}
}

func (s *Server) Start() error {
	serverCtx, serverStopCtx := context.WithCancel(context.Background())

	// Channel to listen for interrupt signals
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
		<-sig
		log.Println("[Server] Shutdown signal received, gracefully shutting down...")

		shutdownCtx, shutdownCancel := context.WithTimeout(serverCtx, 30*time.Second)
		defer shutdownCancel()

		go func() {
			<-shutdownCtx.Done()
			if shutdownCtx.Err() == context.DeadlineExceeded {
				log.Fatal("[Server] Graceful shutdown timeout exceeded, forcing exit.")
			}
		}()

		if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("[Server] HTTP shutdown error: %+v", err)
		}

		if s.db != nil {
			log.Println("[Database] Closing PostgreSQL connection pool...")
			if err := s.db.Close(); err != nil {
				log.Printf("[Database] Error closing connection pool: %v", err)
			}
		}

		serverStopCtx()
	}()

	log.Printf("[Server] %s running in %s mode on http://localhost:%s\n", s.cfg.App.Name, s.cfg.App.Env, s.cfg.Server.Port)
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server error: %w", err)
	}

	<-serverCtx.Done()
	log.Println("[Server] Server stopped successfully.")
	return nil
}
