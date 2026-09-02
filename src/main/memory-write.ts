import { existsSync, readFileSync } from "fs";
import { safeWriteFile } from "./utils";

export interface WriteResult {
  success: boolean;
  error?: string;
  /**
   * Nothing was written because the file changed underneath us, or no longer
   * matches what the user was looking at. The caller should reload its view.
   */
  conflict?: boolean;
}

/** What a mutation wants done with the file it was handed. */
export type Mutation =
  | { content: string }
  | { error: string }
  /** Disk no longer matches what the user saw. Fail now; do not retry. */
  | { conflict: true };

export const MEMORY_CONFLICT_ERROR =
  "The agent changed this file while you were editing. Your view has been " +
  "reloaded — reapply your change.";

/** Current bytes of a memory file; "" when absent or unreadable. */
export function readCurrent(filePath: string): string {
  try {
    return existsSync(filePath) ? readFileSync(filePath, "utf-8") : "";
  } catch {
    return "";
  }
}

function conflict(): WriteResult {
  return { success: false, conflict: true, error: MEMORY_CONFLICT_ERROR };
}

/**
 * Read-modify-write a memory file without clobbering a concurrent writer.
 *
 * Node exposes no flock, so we cannot join the agent's fcntl lock on
 * `<file>.lock`. Two checks stand in for it:
 *
 * 1. The mutation may report `conflict` when the content it was handed no
 *    longer matches what the user was editing (the writer decides; see
 *    memory.ts). That fails immediately — a stale expectation cannot become
 *    fresh by retrying.
 * 2. Immediately before the atomic rename we confirm the on-disk bytes still
 *    match what the mutation was computed from. A losing attempt re-reads and
 *    retries once, which picks up the agent's write and reapplies the caller's
 *    change on top. A second loss fails as a conflict.
 *
 * It never falls back to an unconditional write.
 */
export function mutateMemoryFile(
  filePath: string,
  mutate: (current: string) => Mutation,
): WriteResult {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = readCurrent(filePath);
    const result = mutate(current);
    if ("error" in result) return { success: false, error: result.error };
    if ("conflict" in result) return conflict();
    if (readCurrent(filePath) !== current) continue; // lost the race, retry once
    try {
      safeWriteFile(filePath, result.content);
    } catch (err) {
      // writeMemoryRaw's caller (the agent-sync cloud pull) expects a result,
      // not a throw — preserve that for every writer routed through here.
      return { success: false, error: (err as Error).message };
    }
    return { success: true };
  }
  return conflict();
}
