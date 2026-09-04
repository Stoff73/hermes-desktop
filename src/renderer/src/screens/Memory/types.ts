export interface MemoryEntry {
  index: number;
  content: string;
}

/** Mirrors `MemoryInfo` in src/main/memory.ts. */
export interface MemoryData {
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
  sessions: {
    totalSessions: number;
    totalMessages: number;
    lastSessionAt: number | null;
    available: boolean;
  };
  provider: { active: string | null; installed: boolean };
  vault: { path: string | null; exists: boolean };
}

export interface MemoryProviderInfo {
  name: string;
  description: string;
  installed: boolean;
  active: boolean;
  envVars: string[];
}

/** Mirrors `AgentMemorySummary` in src/main/agents-memory.ts. */
export interface AgentMemorySummary {
  id: string;
  name: string;
  isActive: boolean;
  color?: string;
  avatar?: string | null;
  memoryChars: number;
  memoryLimit: number;
  memoryEntries: number;
  userChars: number;
  userLimit: number;
  totalSessions: number;
  lastSessionAt: number | null;
  provider: string | null;
  vaultLinked: boolean;
  available: boolean;
  status: { state: "running" | "stopped" | "unknown"; issue: string | null };
}
