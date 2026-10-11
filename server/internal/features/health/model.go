package health

import "time"

type Response struct {
	Status    string    `json:"status"`
	App       string    `json:"app"`
	Env       string    `json:"env"`
	Database  string    `json:"database"`
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
}
