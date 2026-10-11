package chat

import "time"

type Message struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"room_id"`
	SenderID  string    `json:"sender_id"`
	Sender    string    `json:"sender"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type Room struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateRoomRequest struct {
	Name string `json:"name"`
}

type SendMessageRequest struct {
	RoomID   string `json:"room_id"`
	SenderID string `json:"sender_id"`
	Sender   string `json:"sender"`
	Content  string `json:"content"`
}
