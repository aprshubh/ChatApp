# ChatApp 🚀

A modern, production-grade real-time messaging application built with **React Native (Expo Router)** on the client, and a high-performance **Go** backend backed by **PostgreSQL**, **Redis**, and **WebSockets**.

---

## 🏗️ Architecture & Features

### 📱 Frontend (React Native + Expo Router)
- **File-Based Routing**: Powered by Expo Router with Stack and Tab layouts (`(auth)`, `(tabs)`, `conversation/[id]`).
- **Local Persistence & Offline First**: Expo SQLite for local message storage, message history queries, and offline outbox sync.
- **Hardware Credential Security**: Refresh tokens stored in `expo-secure-store` with concurrent 401 request deduplication (mutex).
- **Separated State Management**:
  - **Zustand**: UI state, session authentication, theme modes.
  - **TanStack Query**: Server state caching, contact search, conversation invalidations.
- **Resilient WebSocket Integration**:
  - **Durable Persistence Before ACK**: Phone writes incoming messages to SQLite *before* acknowledging to server.
  - Exponential backoff with random jitter for reconnects.
  - `AppState` (background/foreground) & `NetInfo` (network connectivity) lifecycle handlers.

### ⚡ Backend (Go REST & WebSockets)
- **High-Performance Go Engine**: Native HTTP server and Gorilla WebSocket integration.
- **JWT Authentication & Rotation**: Access tokens + Rotated refresh tokens with server-side revocation.
- **PostgreSQL & Redis**: Message storage, delivery status (`pending` -> `sent` -> `delivered` -> `read`), and presence caching.
- **Media Uploads**: Presigned S3/MinIO upload flow.

---

## 📁 Project Structure

```
ChatApp/
├── client/                      # React Native / Expo Mobile App
│   ├── app/                     # Expo Router Routes
│   │   ├── _layout.js           # Root Layout (Providers & Route Protection)
│   │   ├── (auth)/              # Sign In, Register, OTP Verify, Profile Setup
│   │   ├── (tabs)/              # Chats, Contacts, Settings
│   │   └── conversation/[id].js # Dynamic Chat Conversation
│   └── src/
│       ├── database/            # SQLite Local Storage & Outbox
│       ├── services/            # SecureStore, API Service, WebSocket Service
│       ├── stores/              # Zustand Auth & UI Stores
│       └── hooks/               # TanStack Query Hooks
└── server/                      # Go Backend Server
    ├── cmd/server/              # Main Server Entry Point
    ├── config/                  # Configuration Loader
    └── internal/                # Internal Features & Middleware
        ├── features/auth/       # Authentication & Tokens
        ├── features/chat/       # Messaging & Conversations
        └── websocket/           # WebSocket Hub & Delivery Engine
```

---

## 🚀 Getting Started

### Backend Setup
```bash
cd server
# Ensure PostgreSQL & Redis are running (or use docker-compose)
go run main.go
```

### Frontend Setup
```bash
cd client
npm install
npx expo start -c
```

---

## 📄 License
MIT
