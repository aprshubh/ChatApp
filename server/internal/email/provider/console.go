package provider

import (
	"context"
	"log"
)

// ConsoleSender is intended only for local development. Email bodies and
// links are deliberately redacted so secrets never end up in application logs.
type ConsoleSender struct{}

func (ConsoleSender) Send(ctx context.Context, message Message) error {
	if err := ctx.Err(); err != nil { return err }
	log.Printf("[Email DEV] provider=console to=%q subject=%q body=[redacted]", message.To, message.Subject)
	return nil
}
