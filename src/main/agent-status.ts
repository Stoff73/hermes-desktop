import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { profileHome } from "./utils";

/** Unknown is for agents we cannot inspect at all, notably over SSH. */
export type AgentRunState = "running" | "stopped" | "unknown";

export interface AgentRunStatus {
  state: AgentRunState;
  /** Why it is not running, when the gateway recorded a reason. */
  issue: string | null;
}

interface GatewayStateFile {
  gateway_state?: string | null;
  pid?: number | null;
  exit_reason?: string | null;
}

/** True when the pid exists; signal 0 tests for the process without sending. */
function alive(pid: number | null | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether one agent's gateway is up, from its own `gateway_state.json`.
 *
 * The file outlives the process it describes, so a recorded "running" is only
 * believed when its pid is still alive — otherwise a crashed agent shows green
 * forever.
 */
export function readAgentRunStatus(profile?: string): AgentRunStatus {
  const statePath = join(profileHome(profile), "gateway_state.json");
  if (!existsSync(statePath)) return { state: "stopped", issue: null };
  try {
    const parsed = JSON.parse(
      readFileSync(statePath, "utf-8"),
    ) as GatewayStateFile;
    if (parsed.gateway_state === "running") {
      if (alive(parsed.pid)) return { state: "running", issue: null };
      // ponytail: English, like exit_reason itself — the whole reason line is
      // raw gateway text. Translate both together if it ever matters.
      return {
        state: "stopped",
        issue: "recorded as running, but its process is gone",
      };
    }
    return {
      state: "stopped",
      issue: parsed.exit_reason ?? parsed.gateway_state ?? null,
    };
  } catch {
    // An unreadable or half-written state file says nothing about the agent.
    return { state: "unknown", issue: null };
  }
}
