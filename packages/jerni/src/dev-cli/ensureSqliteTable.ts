import sqlite from "bun:sqlite";

export default function ensureSqliteTable(filePath: string) {
  const db = sqlite.open(filePath);

  try {
    db.query(
      `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  payload TEXT NOT NULL,
  meta TEXT NOT NULL,
  type TEXT NOT NULL
  );
  `,
    ).get();
  } finally {
    db.close();
  }
}
