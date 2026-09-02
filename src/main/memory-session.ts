import { existsSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { profileHome } from "./utils";

export interface SessionMemory {
  totalSessions: number;
  totalMessages: number;
  /** Unix seconds of the most recent session start, or null. */
  lastSessionAt: number | null;
  /** state.db exists and could be read. */
  available: boolean;
}

export const UNAVAILABLE_SESSIONS: SessionMemory = {
  totalSessions: 0,
  totalMessages: 0,
  lastSessionAt: null,
  available: false,
};

/**
 * Session-search memory for one profile — the read-only layer the agent
 * searches with FTS5.
 *
 * Deliberately NOT routed through `getDbConnection()`: that resolves
 * `activeStateDbPath()` and caches a single connection, so it can only ever
 * serve the active profile. A short-lived read-only handle, closed in
 * `finally`, lets the overview read every agent without disturbing that cache.
 */
export function readSessionMemory(profile?: string): SessionMemory {
  const dbPath = join(profileHome(profile), "state.db");
  if (!existsSync(dbPath)) return UNAVAILABLE_SESSIONS;

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const row = db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM sessions) AS s, " +
          "(SELECT COUNT(*) FROM messages) AS m, " +
          "(SELECT MAX(started_at) FROM sessions) AS t",
      )
      .get() as { s: number; m: number; t: number | null } | undefined;
    return {
      totalSessions: row?.s ?? 0,
      totalMessages: row?.m ?? 0,
      lastSessionAt: row?.t != null ? Math.floor(row.t) : null,
      available: true,
    };
  } catch (err) {
    console.error("[memory] readSessionMemory failed:", err);
    return UNAVAILABLE_SESSIONS;
  } finally {
    db?.close();
  }
}
