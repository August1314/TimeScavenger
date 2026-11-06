export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS media (
  localIdentifier TEXT PRIMARY KEY NOT NULL,
  cloudIdentifier TEXT,
  mediaType TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  creationDate INTEGER NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  lastReviewedDate INTEGER,
  lastLocallyReviewedDate INTEGER,
  pendingDeletedAt INTEGER
);
CREATE TABLE IF NOT EXISTS deletion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  localIdentifier TEXT NOT NULL,
  mediaType TEXT NOT NULL,
  deletedAt INTEGER NOT NULL,
  fileSize INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
