import { join } from "node:path";
import Database from "better-sqlite3";
import { getDevFilesDir } from "./getDevFilesUtils";

let dbInstance: Database.Database | null = null;

/**
 * Get or create the SQLite database instance for event ID management.
 * Uses a singleton pattern to ensure only one database connection.
 * @returns The SQLite database instance
 */
function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = getEventIdDatabasePath();
    dbInstance = new Database(dbPath);

    // Enable WAL mode for better concurrency and performance
    dbInstance.pragma("journal_mode = WAL");

    // Create the event ID counter table if it doesn't exist
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS event_id_counter (
        id INTEGER PRIMARY KEY
      );
    `);
  }

  return dbInstance;
}

/**
 * Get the next event ID by inserting an empty row and using ROWID auto-increment.
 * This is atomic and leverages SQLite's internal mechanisms for thread safety.
 * @returns The next event ID
 */
export function getNextEventId(): number {
  const db = getDatabase();

  // Insert empty row - ROWID auto-increments atomically
  const result = db
    .prepare(`
      INSERT INTO event_id_counter DEFAULT VALUES 
      RETURNING id
    `)
    .get() as { id: number };

  return result.id;
}

/**
 * Write the last event ID to reset the counter. This clears the table and efficiently
 * inserts the required number of empty rows using multi-row insert optimization.
 * @param lastEventId - The last event ID to set as the counter
 */
export function writeLastEventId(lastEventId: number): void {
  if (lastEventId < 0) {
    throw new Error(`Invalid lastEventId: ${lastEventId}. Must be >= 0`);
  }

  const db = getDatabase();

  db.transaction(() => {
    // Clear existing rows
    db.prepare("DELETE FROM event_id_counter").run();

    if (lastEventId === 0) {
      // No need to insert anything for counter = 0
      return;
    }

    // Use multi-row insert optimization for better performance
    // Insert in batches to avoid SQLite's parameter limit and improve performance
    // Fix: batching logic now correctly inserts all batches, not just two statements
    const BATCH_SIZE = 1000;
    let rowsToInsert = lastEventId;
    while (rowsToInsert > 0) {
      const currentBatchSize = Math.min(BATCH_SIZE, rowsToInsert);
      const values = Array(currentBatchSize).fill("(NULL)").join(",");
      const stmt = db.prepare(`INSERT INTO event_id_counter (id) VALUES ${values}`);
      stmt.run();
      rowsToInsert -= currentBatchSize;
    }
  })();
}

/**
 * Get the path to the SQLite database file for event ID management.
 * @returns The absolute path to the event ID database file
 */
export function getEventIdDatabasePath(): string {
  const dir = getDevFilesDir();
  const dbFileName = "jerni-event-ids.db";
  return join(dir, dbFileName);
}
