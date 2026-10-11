package provider

import "context"

// Message is the provider-neutral representation of an email.
type Message struct {
	From    string
	To      string
	Subject string
	HTML    string
}

// Sender is the provider contract used by the email application service.
type Sender interface {
	Send(ctx context.Context, message Message) error
}
