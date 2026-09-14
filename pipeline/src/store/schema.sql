CREATE TABLE IF NOT EXISTS themen (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  aktualisiert TEXT NOT NULL,
  daten TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS karten (
  thema_id TEXT PRIMARY KEY,
  png_base64 TEXT NOT NULL,
  erstellt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reaktionen (
  thema_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  anzahl INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (thema_id, emoji)
);
