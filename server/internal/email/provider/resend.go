package provider

import (
	"context"
	"fmt"
	"strings"

	"github.com/resend/resend-go/v2"
)

// ResendSender adapts Resend to the provider-neutral Sender interface.
type ResendSender struct { client *resend.Client }

func NewResendSender(apiKey string) (*ResendSender, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" { return nil, fmt.Errorf("RESEND_API_KEY is required for the resend provider") }
	return &ResendSender{client: resend.NewClient(apiKey)}, nil
}

func (s *ResendSender) Send(ctx context.Context, message Message) error {
	if err := ctx.Err(); err != nil { return err }
	if s == nil || s.client == nil { return fmt.Errorf("resend sender is not configured") }
	_, err := s.client.Emails.Send(&resend.SendEmailRequest{
		From: message.From, To: []string{message.To}, Subject: message.Subject, Html: message.HTML,
	})
	if err != nil { return fmt.Errorf("resend send email: %w", err) }
	return nil
}
