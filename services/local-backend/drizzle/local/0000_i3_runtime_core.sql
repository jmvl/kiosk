CREATE TABLE IF NOT EXISTS runtime_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  kiosk_id TEXT,
  current_session_id TEXT,
  local_sequence INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'booting',
  active_package_id TEXT,
  active_package_version TEXT,
  schedule_version TEXT,
  last_heartbeat_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS device_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_type TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL,
  health TEXT NOT NULL DEFAULT '{}',
  last_seen_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(device_type, device_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  kiosk_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  state TEXT NOT NULL,
  token_payload TEXT,
  result_payload TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS sessions_kiosk_idx ON sessions(kiosk_id);
CREATE INDEX IF NOT EXISTS sessions_state_idx ON sessions(state);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  kiosk_id TEXT NOT NULL,
  session_id TEXT REFERENCES sessions(session_id),
  local_sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(local_sequence)
);
CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id);
CREATE INDEX IF NOT EXISTS events_type_idx ON events(event_type);
CREATE TABLE IF NOT EXISTS sync_queue (
  sync_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  local_sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id)
);
CREATE INDEX IF NOT EXISTS sync_queue_status_idx ON sync_queue(status);
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id TEXT PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  kiosk_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  package_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  campaign_short_code TEXT NOT NULL,
  public_ticket_id TEXT NOT NULL UNIQUE,
  key_version TEXT NOT NULL,
  hmac_algorithm TEXT NOT NULL,
  check_length INTEGER NOT NULL,
  redemption_model TEXT NOT NULL,
  render_payload TEXT NOT NULL,
  print_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  printed_at TEXT
);
CREATE INDEX IF NOT EXISTS tickets_session_idx ON tickets(session_id);
CREATE TABLE IF NOT EXISTS print_jobs (
  print_job_id TEXT PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(ticket_id),
  session_id TEXT REFERENCES sessions(session_id),
  kiosk_id TEXT NOT NULL,
  status TEXT NOT NULL,
  request_payload TEXT NOT NULL,
  result_payload TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS print_jobs_session_idx ON print_jobs(session_id);
CREATE INDEX IF NOT EXISTS print_jobs_status_idx ON print_jobs(status);
INSERT INTO runtime_state (id, local_sequence, mode, updated_at)
VALUES (1, 0, 'booting', strftime('%Y-%m-%dT%H:%M:%fZ','now'))
ON CONFLICT(id) DO NOTHING;
