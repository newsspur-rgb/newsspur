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
