import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new Database(join(dataDir, 'events.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  scrape_interval_minutes INTEGER NOT NULL DEFAULT 360,
  last_run TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES sources(id),
  external_key TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  source_url TEXT,
  raw_content TEXT,
  parsed_json TEXT NOT NULL,
  content_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_raw_events_source ON raw_events(source_id, external_key);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  venue TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  start_time TEXT,
  end_time TEXT,
  date_precision TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  organizer TEXT,
  image_url TEXT,
  event_url TEXT,
  ticket_url TEXT,
  source_confidence REAL NOT NULL DEFAULT 0.5,
  source_status TEXT NOT NULL DEFAULT 'unverified',
  source_conflict INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_verified_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_city_date ON events(city, start_time);
CREATE INDEX IF NOT EXISTS idx_events_canonical ON events(canonical_key);

CREATE TABLE IF NOT EXISTS event_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id),
  raw_event_id INTEGER REFERENCES raw_events(id),
  external_key TEXT NOT NULL,
  source_url TEXT,
  priority INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(source_id, external_key)
);
CREATE INDEX IF NOT EXISTS idx_event_sources_event ON event_sources(event_id);

CREATE TABLE IF NOT EXISTS event_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_id TEXT,
  changed_at TEXT NOT NULL,
  field TEXT NOT NULL,
  previous_value TEXT,
  current_value TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_changes_event ON event_changes(event_id);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES sources(id),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  events_found INTEGER NOT NULL DEFAULT 0,
  events_created INTEGER NOT NULL DEFAULT 0,
  events_updated INTEGER NOT NULL DEFAULT 0,
  events_removed INTEGER NOT NULL DEFAULT 0,
  events_unchanged INTEGER NOT NULL DEFAULT 0,
  duplicates INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  message TEXT
);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_source ON scrape_runs(source_id, started_at);

CREATE TABLE IF NOT EXISTS scrape_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES scrape_runs(id),
  source_id TEXT,
  occurred_at TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  UNIQUE(date, name)
);

CREATE TABLE IF NOT EXISTS geocode_cache (
  query TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  venue TEXT,
  latitude REAL,
  longitude REAL,
  precision TEXT NOT NULL,
  display_name TEXT,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduler_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`)

const eventCols = db.prepare(`PRAGMA table_info(events)`).all() as Array<{ name: string }>
if (!eventCols.some((c) => c.name === 'location_precision')) {
  db.exec(`ALTER TABLE events ADD COLUMN location_precision TEXT`)
}

export const nowIso = (): string => new Date().toISOString()
