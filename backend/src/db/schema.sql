-- Users authenticated via Google OAuth
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One Slack webhook/token per user (tenant). Absence of a row = not connected.
CREATE TABLE IF NOT EXISTS slack_integrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_name TEXT,
  access_token TEXT,
  incoming_webhook_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Each row is one email to send. This is the source of truth;
-- BullMQ only holds an ephemeral delayed job that points back to emails.id.
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | processing | sent | failed | rescheduled
  bullmq_job_id TEXT,               -- current BullMQ job id backing this row (idempotency anchor)
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  batch_id TEXT,                    -- groups emails scheduled together from one "compose" submission
  min_delay_ms INTEGER NOT NULL DEFAULT 2000,
  hourly_limit INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_scheduled_time ON emails(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_emails_batch ON emails(batch_id);
