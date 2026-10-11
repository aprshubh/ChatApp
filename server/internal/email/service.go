package email

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"log"
	"net/url"
	"strings"
	"time"

	"chatapp/server/config"
	"chatapp/server/internal/email/provider"
)

// Service exposes application-level email use cases to feature services.
// Provider selection and provider-specific details stay inside this package.
type Service interface {
	SendVerificationEmail(toEmail, username, verificationToken string) error
	SendPasswordResetEmail(toEmail, username, resetToken string) error
	SendEmail(to string, subject string, htmlBody string) error
}

type emailService struct {
	sender  provider.Sender
	cfg     config.EmailConfig
	appName string
}

type unavailableSender struct{ err error }

func (s unavailableSender) Send(context.Context, provider.Message) error { return s.err }

// NewService selects an email provider from configuration. Invalid configuration
// is retained as an erroring sender so application startup and unrelated routes
// remain available, while email operations fail visibly instead of pretending
// that an email was delivered.
func NewService(cfg config.EmailConfig, appName string) Service {
	var sender provider.Sender
	var err error
	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case "resend":
		sender, err = provider.NewResendSender(cfg.ResendAPIKey)
	case "smtp":
		sender, err = provider.NewSMTPSender(provider.SMTPConfig{
			Host: cfg.SMTPHost, Port: cfg.SMTPPort,
			Username: cfg.SMTPUsername, Password: cfg.SMTPPassword,
		})
	case "console":
		if !strings.EqualFold(cfg.Environment, "development") && !strings.EqualFold(cfg.Environment, "test") {
			err = fmt.Errorf("console email provider is allowed only in development or test")
		} else {
			sender = provider.ConsoleSender{}
		}
	default:
		err = fmt.Errorf("unsupported EMAIL_PROVIDER %q (supported: resend, smtp, console)", cfg.Provider)
	}
	if err != nil {
		log.Printf("[Email] Provider configuration error: %v", err)
		sender = unavailableSender{err: err}
	} else {
		log.Printf("[Email] Provider configured: %s", strings.ToLower(strings.TrimSpace(cfg.Provider)))
	}
	if appName == "" {
		appName = "ChatApp"
	}
	return &emailService{sender: sender, cfg: cfg, appName: appName}
}

func (s *emailService) SendVerificationEmail(toEmail, username, verificationToken string) error {
	verifyURL, err := url.Parse(strings.TrimRight(s.cfg.AppURL, "/") + "/api/v1/auth/verify")
	if err != nil {
		return fmt.Errorf("build verification URL: %w", err)
	}
	query := verifyURL.Query()
	query.Set("token", verificationToken)
	verifyURL.RawQuery = query.Encode()

	subject := fmt.Sprintf("Verify your email address - %s", s.appName)
	body, err := renderHTML(verificationTemplate, map[string]string{
		"AppName": s.appName, "Username": username,
		"VerifyURL": verifyURL.String(), "Token": verificationToken,
	})
	if err != nil {
		return fmt.Errorf("render verification email: %w", err)
	}
	return s.send(toEmail, subject, body)
}

func (s *emailService) SendPasswordResetEmail(toEmail, username, resetToken string) error {
	subject := fmt.Sprintf("Reset your %s password", s.appName)
	body, err := renderHTML(passwordResetTemplate, map[string]string{
		"AppName": s.appName, "Username": username, "Token": resetToken,
	})
	if err != nil {
		return fmt.Errorf("render password reset email: %w", err)
	}
	return s.send(toEmail, subject, body)
}

// SendEmail remains available for existing callers while the transport is
// provider-neutral. Do not log the body: it can contain private information.
func (s *emailService) SendEmail(to, subject, htmlBody string) error {
	return s.send(to, subject, htmlBody)
}

func (s *emailService) send(to, subject, htmlBody string) error {
	if s.sender == nil {
		return fmt.Errorf("email sender is not configured")
	}
	if strings.TrimSpace(to) == "" || strings.ContainsAny(to, "\r\n") {
		return fmt.Errorf("email recipient is invalid")
	}
	if strings.TrimSpace(s.cfg.From) == "" || strings.ContainsAny(s.cfg.From, "\r\n") {
		return fmt.Errorf("EMAIL_FROM is invalid")
	}
	if strings.ContainsAny(subject, "\r\n") {
		return fmt.Errorf("email subject contains invalid line breaks")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := s.sender.Send(ctx, provider.Message{
		From: s.cfg.From, To: to, Subject: subject, HTML: htmlBody,
	}); err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	return nil
}

func renderHTML(source string, data any) (string, error) {
	tmpl, err := template.New("email").Parse(source)
	if err != nil {
		return "", err
	}
	var output bytes.Buffer
	if err := tmpl.Execute(&output, data); err != nil {
		return "", err
	}
	return output.String(), nil
}

const verificationTemplate = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify your {{.AppName}} account</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;color:#333;padding:20px">
<div style="max-width:580px;margin:auto;background:#fff;border-radius:8px;padding:28px">
<h1>{{.AppName}}</h1><h2>Welcome, {{.Username}}!</h2>
<p>Please verify your email address using the link below:</p>
<p><a href="{{.VerifyURL}}">Verify email address</a></p>
<p>If the link does not work, use this verification token in the app:</p>
<p style="font-family:monospace;overflow-wrap:anywhere">{{.Token}}</p>
<p style="font-size:13px;color:#64748b">This link expires in 24 hours. If you did not create this account, ignore this email.</p>
</div></body></html>`

const passwordResetTemplate = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset your {{.AppName}} password</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;color:#333;padding:20px">
<div style="max-width:580px;margin:auto;background:#fff;border-radius:8px;padding:28px">
<h1>{{.AppName}} password reset</h1><h2>Hello, {{.Username}}</h2>
<p>Use this reset token in the app to choose a new password:</p>
<p style="font-family:monospace;overflow-wrap:anywhere">{{.Token}}</p>
<p style="font-size:13px;color:#64748b">This token expires in 1 hour. If you did not request a password reset, ignore this email.</p>
</div></body></html>`
