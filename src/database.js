const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'warranted.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS levels (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS level_rewards (
  guild_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, level)
);

CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  welcome_channel TEXT,
  welcome_message TEXT,
  goodbye_channel TEXT,
  goodbye_message TEXT,
  autorole TEXT,
  log_channel TEXT
);

CREATE TABLE IF NOT EXISTS reaction_roles (
  message_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  role_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  PRIMARY KEY (message_id, emoji)
);

CREATE TABLE IF NOT EXISTS ticket_panels (
  message_id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  title TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS ticket_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_message_id TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  opener_id TEXT NOT NULL,
  option_label TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at INTEGER NOT NULL,
  closed_at INTEGER,
  closed_by TEXT
);

CREATE TABLE IF NOT EXISTS ticket_blacklist (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS temp_voice_channels (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_board (
  original_message_id TEXT PRIMARY KEY,
  board_message_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  reaction_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS informant_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  response TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS informant_timers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message TEXT NOT NULL,
  interval_ms INTEGER NOT NULL,
  last_sent_at INTEGER NOT NULL DEFAULT 0
);
`);

// Safe migration: guild_config gained two new columns for the ticket system
// after some servers already had a database file. ALTER TABLE errors if the
// column already exists, so each one is wrapped and ignored on repeat runs.
const migrations = [
  'ALTER TABLE guild_config ADD COLUMN ticket_category TEXT',
  'ALTER TABLE guild_config ADD COLUMN ticket_staff_role TEXT',
  'ALTER TABLE guild_config ADD COLUMN vm_join_channel TEXT',
  'ALTER TABLE guild_config ADD COLUMN evidence_channel TEXT',
  'ALTER TABLE guild_config ADD COLUMN evidence_emoji TEXT',
  'ALTER TABLE guild_config ADD COLUMN evidence_threshold INTEGER',
  'ALTER TABLE guild_config ADD COLUMN ticket_transcript_channel TEXT'
];
for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (err) {
    if (!err.message.includes('duplicate column')) throw err;
  }
}

module.exports = db;
