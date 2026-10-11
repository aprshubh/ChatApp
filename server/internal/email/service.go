package email

import (
	"fmt"
	"log"
	"net/url"
	"strings"

	"chatapp/server/config"

	"github.com/resend/resend-go/v2"
)

type Service interface {
	SendVerificationEmail(toEmail, username, verificationToken string) error
	SendPasswordResetEmail(toEmail, username, resetToken string) error
	SendEmail(to string, subject string, htmlBody string) error
}

type emailService struct {
	client  *resend.Client
	cfg     config.EmailConfig
	appName string
}

func NewService(cfg config.EmailConfig, appName string) Service {
	apiKey := strings.TrimSpace(cfg.ResendAPIKey)
	var client *resend.Client
	if apiKey != "" {
		client = resend.NewClient(apiKey)
		log.Println("[Email Service] Initialized Resend client with provided API key")
	} else {
		log.Println("[Email Service] Notice: RESEND_API_KEY is not set. Running in development console log mode.")
	}

	return &emailService{
		client:  client,
		cfg:     cfg,
		appName: appName,
	}
}

func (s *emailService) SendVerificationEmail(toEmail, username, verificationToken string) error {
	verifyURL := fmt.Sprintf("%s/api/v1/auth/verify?token=%s",
		strings.TrimRight(s.cfg.AppURL, "/"),
		url.QueryEscape(verificationToken),
	)

	subject := fmt.Sprintf("Verify your email address - %s", s.appName)
	html := buildVerificationEmailHTML(s.appName, username, verifyURL, verificationToken)

	// In dev mode (when Resend API key is not configured), print the verification link directly to the console
	if s.client == nil {
		log.Printf("\n==================== [DEV EMAIL LOG] ====================\n"+
			"To: %s\n"+
			"Subject: %s\n"+
			"Verification Link: %s\n"+
			"Token: %s\n"+
			"=========================================================\n",
			toEmail, subject, verifyURL, verificationToken)
		return nil
	}

	return s.SendEmail(toEmail, subject, html)
}

func (s *emailService) SendPasswordResetEmail(toEmail, username, resetToken string) error {
	subject := fmt.Sprintf("Reset your %s password", s.appName)
	html := buildPasswordResetEmailHTML(s.appName, username, resetToken)

	if s.client == nil {
		log.Printf("\n==================== [DEV PASSWORD RESET] ====================\n"+
			"To: %s\n"+
			"Subject: %s\n"+
			"Reset Token: %s\n"+
			"==============================================================\n",
			toEmail, subject, resetToken)
		return nil
	}

	return s.SendEmail(toEmail, subject, html)
}

func (s *emailService) SendEmail(to, subject, htmlBody string) error {
	if s.client == nil {
		log.Printf("[Email Service DEV] Sent email to %s with subject %q", to, subject)
		return nil
	}

	from := s.cfg.From
	if from == "" {
		from = "onboarding@resend.dev"
	}

	params := &resend.SendEmailRequest{
		From:    from,
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
	}

	sent, err := s.client.Emails.Send(params)
	if err != nil {
		return fmt.Errorf("resend send error: %w", err)
	}

	log.Printf("[Email Service] Email successfully sent to %s (ID: %s)", to, sent.Id)
	return nil
}

func buildVerificationEmailHTML(appName, username, verifyURL, token string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your %s account</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #333; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: #4f46e5; color: #ffffff; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .button-wrapper { text-align: center; margin: 30px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .token-box { background: #f3f4f6; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; text-align: center; font-family: monospace; font-size: 16px; letter-spacing: 2px; color: #1e293b; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>%s</h1>
    </div>
    <div class="content">
      <h2>Welcome, %s!</h2>
      <p>Thank you for creating an account. Please click the button below to verify your email address and activate your account:</p>
      
      <div class="button-wrapper">
        <a href="%s" class="btn" target="_blank">Verify Email Address</a>
      </div>

      <p>Or use this verification token directly:</p>
      <div class="token-box">%s</div>

      <p style="font-size: 13px; color: #64748b;">If the button does not work, copy and paste this link into your browser:<br>
      <a href="%s" style="color: #4f46e5; word-break: break-all;">%s</a></p>

      <p style="margin-top: 30px; font-size: 13px; color: #94a3b8;">This link will expire in 24 hours. If you did not create this account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      &copy; %s. All rights reserved.
    </div>
  </div>
</body>
</html>`, appName, appName, username, verifyURL, token, verifyURL, verifyURL, appName)
}

func buildPasswordResetEmailHTML(appName, username, token string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #333; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: #ef4444; color: #ffffff; padding: 25px 20px; text-align: center; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .token-box { background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 6px; padding: 14px; text-align: center; font-family: monospace; font-size: 20px; letter-spacing: 3px; font-weight: bold; color: #b91c1c; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Password Reset</h1></div>
    <div class="content">
      <h2>Hello, %s</h2>
      <p>We received a request to reset your password for <strong>%s</strong>. Use the secure reset token below to choose a new password:</p>
      <div class="token-box">%s</div>
      <p style="font-size: 13px; color: #64748b;">This code will expire in 1 hour. If you did not request a password reset, please ignore this email.</p>
    </div>
    <div class="footer">&copy; %s. All rights reserved.</div>
  </div>
</body>
</html>`, username, appName, token, appName)
}
