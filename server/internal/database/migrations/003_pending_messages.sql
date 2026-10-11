-- ==============================================================================
-- 003_pending_messages.sql: Store-and-Forward Ephemeral Queue & Client Devices
-- ==============================================================================

-- 1. Devices table (E2EE device keys & multi-device identity)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(128) NOT NULL,
    device_name VARCHAR(128) DEFAULT 'Mobile Device',
    public_identity_key TEXT, -- Pre-key / E2EE Identity key
    last_active_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_user_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- 2. Pending Messages (Store-and-forward queue)
-- Messages stay here until recipient device sends an explicit ACK, then they are deleted.
CREATE TABLE IF NOT EXISTS pending_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    delivery_attempts INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,
    CONSTRAINT uq_pending_message_recipient UNIQUE (message_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_messages_recipient ON pending_messages(recipient_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_pending_messages_expires ON pending_messages(expires_at);
