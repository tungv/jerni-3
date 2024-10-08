import fs from "node:fs";
import Database from "better-sqlite3";
import debounce from "../lib/debounce.mjs";
import readEventsFromMarkdown from "@jerni/jerni-3/dev-cli/readEventsFromMarkdown";
import rewriteChecksum from "@jerni/jerni-3/dev-cli/rewriteChecksum";

export default debounce(async function scheduleCleanStartJerni(absoluteEventsFilePath, sqliteAbsoluteFilePath) {
  // read events from markdown file
  const { events, realChecksum, fileChecksum } = await readEventsFromMarkdown(absoluteEventsFilePath);

  if (realChecksum !== fileChecksum) {
    // todo: should not wait
    await rewriteChecksum(absoluteEventsFilePath);
  }

  try {
    cleanSqliteDatabase(sqliteAbsoluteFilePath);
  } catch (error) {
    console.error(red(`Error cleaning SQLite database: ${error.message}`));
    return; // Exit if we can't clean the database
  }

  try {
    const insertedCount = insertEvents(events);
  } catch (error) {
    console.error(red(`Error inserting events: ${error.message}`));
  }

  injectEventsIntoWebpack(events);

  globalThis.CLEAN_START_JERNI = true; // fixme: undocumented
}, 300);

function bold(text) {
  return `\x1b[1m${text}\x1b[0m`;
}

function red(text) {
  return `\x1b[31m${text}\x1b[0m`;
}

function cleanSqliteDatabase(sqliteFilePath) {
  const db = new Database(sqliteFilePath);

  try {
    // Drop the events table if it exists
    db.exec("DROP TABLE IF EXISTS events");

    // Recreate the events table
    db.exec(`CREATE TABLE events (
      id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      meta TEXT NOT NULL,
      type TEXT NOT NULL
    )`);
  } catch (error) {
    console.error(red(`Error cleaning SQLite database: ${error.message}`));
    throw error;
  } finally {
    db.close();
  }
}

function insertEvents(events, sqliteFilePath = "events.sqlite") {
  const db = new Database(sqliteFilePath);
  let insertedCount = 0;

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      meta TEXT NOT NULL,
      type TEXT NOT NULL
    )`);

    const stmt = db.prepare("INSERT INTO events (payload, meta, type) VALUES (?, ?, ?)");

    for (const event of events) {
      stmt.run(JSON.stringify(event.payload), JSON.stringify(event.meta || {}), event.type);
      insertedCount++;
    }

    return insertedCount;
  } catch (error) {
    console.error(red(`Error in insertEvents: ${error.message}`));
    throw error;
  } finally {
    db.close();
  }
}

function injectEventsIntoWebpack(events) {
  globalThis.__JERNI_EVENTS__ = events;
}
