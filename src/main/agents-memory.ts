import { listProfiles } from "./profiles";
import { readMemory, type MemoryInfo } from "./memory";

/** Identity fields copied from the profile list. */
export interface AgentMemoryBase {
  id: string;
  name: string;
  isActive: boolean;
  color?: string;
  avatar?: string | null;
}

export interface AgentMemorySummary extends AgentMemoryBase {
  memoryChars: number;
  memoryLimit: number;
  memoryEntries: number;
  userChars: number;
  userLimit: number;
  totalSessions: number;
  lastSessionAt: number | null;
  provider: string | null;
  vaultLinked: boolean;
  /** False when this agent's stores could not be read at all. */
  available: boolean;
}

/** Reduce a full MemoryInfo to the overview row. Shared with the SSH branch. */
export function summariseAgentMemory(
  base: AgentMemoryBase,
  m: MemoryInfo,
): AgentMemorySummary {
  return {
    ...base,
    memoryChars: m.memory.charCount,
    memoryLimit: m.memory.charLimit,
    memoryEntries: m.memory.entries.length,
    userChars: m.user.charCount,
    userLimit: m.user.charLimit,
    totalSessions: m.sessions.totalSessions,
    lastSessionAt: m.sessions.lastSessionAt,
    provider: m.provider.active,
    vaultLinked: m.vault.path !== null,
    available: true,
  };
}

export function unavailableAgentMemory(
  base: AgentMemoryBase,
): AgentMemorySummary {
  return {
    ...base,
    memoryChars: 0,
    memoryLimit: 0,
    memoryEntries: 0,
    userChars: 0,
    userLimit: 0,
    totalSessions: 0,
    lastSessionAt: null,
    provider: null,
    vaultLinked: false,
    available: false,
  };
}

/**
 * One memory summary per agent, for the cross-agent overview.
 *
 * One unreadable agent must not blank the list, so each read is isolated and
 * degrades to an unavailable row.
 */
export async function readAllAgentsMemory(): Promise<AgentMemorySummary[]> {
  const profiles = await listProfiles();
  return profiles.map((p) => {
    const base: AgentMemoryBase = {
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      color: p.color,
      avatar: p.avatar,
    };
    try {
      return summariseAgentMemory(base, readMemory(p.id));
    } catch (err) {
      console.error(`[memory] summary failed for ${p.id}:`, err);
      return unavailableAgentMemory(base);
    }
  });
}
