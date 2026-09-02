import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { profileHome } from "./utils";
import { parseMemoryLimitsConfig, type MemoryLimits } from "./memory-limits";
import {
  mutateMemoryFile,
  type Mutation,
  type WriteResult,
} from "./memory-write";
import { readSessionMemory, type SessionMemory } from "./memory-session";
import { getActiveMemoryProvider, discoverMemoryProviders } from "./installer";
import { readEnv } from "./config";

const ENTRY_DELIMITER = "\n§\n";

export interface MemoryEntry {
  index: number;
  content: string;
}

export interface ProviderMemory {
  /** memory.provider from config.yaml, or null when built-in only. */
  active: string | null;
  /** The active provider's plugin is present in this installation. */
  installed: boolean;
}

export interface VaultMemory {
  /** OBSIDIAN_VAULT_PATH from the profile .env, or null when unset. */
  path: string | null;
  /** That directory exists on this machine. */
  exists: boolean;
}

export interface MemoryInfo {
  memory: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    entries: MemoryEntry[];
    charCount: number;
    charLimit: number;
  };
  user: {
    content: string;
    exists: boolean;
    lastModified: number | null;
    charCount: number;
    charLimit: number;
  };
  sessions: SessionMemory;
  provider: ProviderMemory;
  vault: VaultMemory;
}

function memoryPath(profile?: string): string {
  return join(profileHome(profile), "memories", "MEMORY.md");
}

function userPath(profile?: string): string {
  return join(profileHome(profile), "memories", "USER.md");
}

function configPath(profile?: string): string {
  return join(profileHome(profile), "config.yaml");
}

function readMemoryLimits(profile?: string): MemoryLimits {
  try {
    const filePath = configPath(profile);
    if (!existsSync(filePath)) return parseMemoryLimitsConfig("");
    return parseMemoryLimitsConfig(readFileSync(filePath, "utf-8"));
  } catch {
    return parseMemoryLimitsConfig("");
  }
}

function readFileSafe(filePath: string): {
  content: string;
  exists: boolean;
  lastModified: number | null;
} {
  if (!existsSync(filePath)) {
    return { content: "", exists: false, lastModified: null };
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const stat = statSync(filePath);
    return {
      content,
      exists: true,
      lastModified: Math.floor(stat.mtimeMs / 1000),
    };
  } catch {
    return { content: "", exists: false, lastModified: null };
  }
}

function parseMemoryEntries(content: string): MemoryEntry[] {
  if (!content.trim()) return [];
  return content
    .split(ENTRY_DELIMITER)
    .map((entry, index) => ({ index, content: entry.trim() }))
    .filter((e) => e.content.length > 0);
}

function serializeEntries(entries: MemoryEntry[]): string {
  return entries.map((e) => e.content).join(ENTRY_DELIMITER);
}

function readProviderMemory(profile?: string): ProviderMemory {
  try {
    // `|| null` matters: MemoryProviders.handleDeactivate writes
    // `memory.provider: ""`, and `"" ?? fallback` would render an empty string.
    const active = getActiveMemoryProvider(profile) || null;
    if (!active) return { active: null, installed: false };
    const installed = discoverMemoryProviders(profile).some(
      (p) => p.name === active,
    );
    return { active, installed };
  } catch {
    return { active: null, installed: false };
  }
}

/**
 * The Obsidian vault is not a memory provider; it is a folder the agent's
 * bundled note-taking skill reads and writes, located by OBSIDIAN_VAULT_PATH
 * in the profile .env. The desktop only ever writes that path.
 */
function readVaultMemory(profile?: string): VaultMemory {
  try {
    const path = (readEnv(profile).OBSIDIAN_VAULT_PATH ?? "").trim() || null;
    return { path, exists: !!path && existsSync(path) };
  } catch {
    return { path: null, exists: false };
  }
}

// ── Read ────────────────────────────────────────────

export function readMemory(profile?: string): MemoryInfo {
  const memFile = readFileSafe(memoryPath(profile));
  const userFile = readFileSafe(userPath(profile));
  const limits = readMemoryLimits(profile);

  return {
    memory: {
      ...memFile,
      entries: parseMemoryEntries(memFile.content),
      charCount: memFile.content.length,
      charLimit: limits.memoryCharLimit,
    },
    user: {
      ...userFile,
      charCount: userFile.content.length,
      charLimit: limits.userCharLimit,
    },
    sessions: readSessionMemory(profile),
    provider: readProviderMemory(profile),
    vault: readVaultMemory(profile),
  };
}

/** Raw MEMORY.md content (empty string when missing) — for whole-file sync. */
export function readMemoryRaw(profile?: string): string {
  return readFileSafe(memoryPath(profile)).content;
}

/**
 * Replace MEMORY.md wholesale. Used by cloud agent sync when the remote copy
 * wins — the content is the user's own cloud copy, so no entry parsing or
 * char-limit gate applies, and there is no "what the user saw" to check
 * against. Still goes through the compare-and-swap so a concurrent agent
 * write is retried over rather than clobbered.
 */
export function writeMemoryRaw(content: string, profile?: string): WriteResult {
  return mutateMemoryFile(memoryPath(profile), () => ({ content }));
}

// ── Write operations ────────────────────────────────

/**
 * Guard for index-addressed edits. `expected` is the entry text the user was
 * looking at. If the index is gone or holds different text now, the agent has
 * reordered the file underneath the user and the edit must not land.
 */
function entryStillMatches(
  entries: MemoryEntry[],
  index: number,
  expected: string | undefined,
): Mutation | null {
  if (index < 0 || index >= entries.length) {
    return expected === undefined
      ? { error: "Entry not found" }
      : { conflict: true };
  }
  if (expected !== undefined && entries[index].content !== expected.trim()) {
    return { conflict: true };
  }
  return null;
}

export function addMemoryEntry(content: string, profile?: string): WriteResult {
  const limits = readMemoryLimits(profile);
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    const next = serializeEntries([
      ...entries,
      { index: entries.length, content: content.trim() },
    ]);
    if (next.length > limits.memoryCharLimit) {
      return {
        error: `Would exceed memory limit (${next.length}/${limits.memoryCharLimit} chars)`,
      };
    }
    return { content: next };
  });
}

export function updateMemoryEntry(
  index: number,
  content: string,
  profile?: string,
  expected?: string,
): WriteResult {
  const limits = readMemoryLimits(profile);
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    const stale = entryStillMatches(entries, index, expected);
    if (stale) return stale;
    entries[index] = { ...entries[index], content: content.trim() };
    const next = serializeEntries(entries);
    if (next.length > limits.memoryCharLimit) {
      return {
        error: `Would exceed memory limit (${next.length}/${limits.memoryCharLimit} chars)`,
      };
    }
    return { content: next };
  });
}

export function removeMemoryEntry(
  index: number,
  profile?: string,
  expected?: string,
): WriteResult {
  return mutateMemoryFile(memoryPath(profile), (current) => {
    const entries = parseMemoryEntries(current);
    const stale = entryStillMatches(entries, index, expected);
    if (stale) return stale;
    entries.splice(index, 1);
    return { content: serializeEntries(entries) };
  });
}

export function writeUserProfile(
  content: string,
  profile?: string,
  expected?: string,
): WriteResult {
  const limits = readMemoryLimits(profile);
  if (content.length > limits.userCharLimit) {
    return {
      success: false,
      error: `Exceeds limit (${content.length}/${limits.userCharLimit} chars)`,
    };
  }
  return mutateMemoryFile(userPath(profile), (current) => {
    if (expected !== undefined && current !== expected)
      return { conflict: true };
    return { content };
  });
}
