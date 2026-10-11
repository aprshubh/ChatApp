package provider

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

// SMTPConfig contains SMTP submission settings.
type SMTPConfig struct { Host, Port, Username, Password string }

// SMTPSender supports implicit TLS on port 465 and mandatory STARTTLS on
// other submission ports. It never sends credentials over plaintext SMTP.
type SMTPSender struct { cfg SMTPConfig }

func NewSMTPSender(cfg SMTPConfig) (*SMTPSender, error) {
	cfg.Host, cfg.Port = strings.TrimSpace(cfg.Host), strings.TrimSpace(cfg.Port)
	if cfg.Host == "" || cfg.Port == "" { return nil, fmt.Errorf("SMTP_HOST and SMTP_PORT are required for the smtp provider") }
	if (cfg.Username == "") != (cfg.Password == "") { return nil, fmt.Errorf("SMTP_USERNAME and SMTP_PASSWORD must be configured together") }
	return &SMTPSender{cfg: cfg}, nil
}

func (s *SMTPSender) Send(ctx context.Context, message Message) error {
	if err := ctx.Err(); err != nil { return err }
	conn, err := (&net.Dialer{Timeout: 10*time.Second}).DialContext(ctx, "tcp", net.JoinHostPort(s.cfg.Host, s.cfg.Port))
	if err != nil { return fmt.Errorf("connect to SMTP server: %w", err) }
	defer conn.Close()
	if deadline, ok := ctx.Deadline(); ok { _ = conn.SetDeadline(deadline) } else { _ = conn.SetDeadline(time.Now().Add(15*time.Second)) }
	if s.cfg.Port == "465" {
		tlsConn := tls.Client(conn, &tls.Config{ServerName:s.cfg.Host, MinVersion:tls.VersionTLS12})
		if err := tlsConn.HandshakeContext(ctx); err != nil { return fmt.Errorf("establish SMTP TLS: %w", err) }
		conn = tlsConn
	}
	client, err := smtp.NewClient(conn, s.cfg.Host)
	if err != nil { return fmt.Errorf("initialize SMTP client: %w", err) }
	defer client.Close()
	if s.cfg.Port != "465" {
		if ok, _ := client.Extension("STARTTLS"); !ok { return fmt.Errorf("SMTP server does not advertise STARTTLS; refusing an unencrypted connection") }
		if err := client.StartTLS(&tls.Config{ServerName:s.cfg.Host, MinVersion:tls.VersionTLS12}); err != nil { return fmt.Errorf("start SMTP TLS: %w", err) }
	}
	if s.cfg.Username != "" {
		if ok, _ := client.Extension("AUTH"); !ok { return fmt.Errorf("SMTP server does not support AUTH") }
		if err := client.Auth(smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)); err != nil { return fmt.Errorf("authenticate with SMTP server: %w", err) }
	}
	if err := client.Mail(message.From); err != nil { return fmt.Errorf("set SMTP sender: %w", err) }
	if err := client.Rcpt(message.To); err != nil { return fmt.Errorf("set SMTP recipient: %w", err) }
	writer, err := client.Data()
	if err != nil { return fmt.Errorf("open SMTP message: %w", err) }
	subject := strings.NewReplacer("\r", "", "\n", "").Replace(message.Subject)
	payload := "To: "+message.To+"\r\nFrom: "+message.From+"\r\nSubject: "+subject+"\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n"+message.HTML
	if _, err := writer.Write([]byte(payload)); err != nil { _ = writer.Close(); return fmt.Errorf("write SMTP message: %w", err) }
	if err := writer.Close(); err != nil { return fmt.Errorf("finish SMTP message: %w", err) }
	if err := client.Quit(); err != nil { return fmt.Errorf("close SMTP session: %w", err) }
	return nil
}
