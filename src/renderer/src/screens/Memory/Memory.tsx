import { useState, useEffect, useCallback } from "react";
import { Refresh } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";
import { OrbLoader } from "../../components/OrbLoader";
import ProfileAvatar from "../../components/common/ProfileAvatar";
import { CapacityBar } from "./CapacityBar";
import { relativeTime } from "./MemorySystems";
import type { AgentMemorySummary } from "./types";

interface MemoryProps {
  /** Called with the profile id when a row is selected. */
  onOpenAgent?: (profileId: string) => void;
}

/**
 * Cross-agent memory overview. Reads only — every write happens in Agent
 * Settings (ProfileModal → Memory), so there is exactly one place that edits
 * memory. Selecting a row opens that agent there.
 */
function Memory({ onOpenAgent }: MemoryProps): React.JSX.Element {
  const { t } = useI18n();
  const [agents, setAgents] = useState<AgentMemorySummary[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setAgents(await window.hermesAPI.readAllAgentsMemory());
    } catch {
      setAgents([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!agents) {
    return (
      <div className="settings-container">
        <h1 className="settings-header">{t("memory.title")}</h1>
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <OrbLoader state="searching" size={64} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="memory-header">
        <div>
          <h1 className="settings-header" style={{ marginBottom: 4 }}>
            {t("memory.title")}
          </h1>
          <p className="memory-subtitle">{t("memory.overviewSubtitle")}</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => void load()}
        >
          <Refresh size={13} />
        </button>
      </div>

      <div className="memory-agents">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`memory-agent ${a.isActive ? "is-active" : ""}`}
            data-testid={`memory-agent-${a.id}`}
            title={t("memory.openAgentMemory")}
            onClick={() => onOpenAgent?.(a.id)}
          >
            <div className="memory-agent-head">
              <ProfileAvatar
                name={a.id}
                color={a.color}
                avatar={a.avatar}
                size={28}
              />
              <span className="memory-agent-name">{a.name}</span>
              <span
                className={`memory-agent-dot is-${a.status.state}`}
                data-testid={`memory-agent-dot-${a.id}`}
                title={t(`memory.runState.${a.status.state}`)}
                aria-label={t(`memory.runState.${a.status.state}`)}
              />
              {a.isActive && (
                <span className="memory-agent-active">
                  {t("memory.activeAgent")}
                </span>
              )}
            </div>
            {a.status.state === "stopped" && (
              <div className="memory-agent-issue">
                {a.status.issue
                  ? t("memory.runIssue", { reason: a.status.issue })
                  : t("memory.runState.stopped")}
              </div>
            )}
            {a.available ? (
              <div className="memory-agent-metrics">
                <div className="memory-agent-bars">
                  <CapacityBar
                    used={a.memoryChars}
                    limit={a.memoryLimit}
                    label={t("memory.agentMemory")}
                    tone="neutral"
                  />
                  <CapacityBar
                    used={a.userChars}
                    limit={a.userLimit}
                    label={t("memory.userProfile")}
                    tone="neutral"
                  />
                </div>
                <div className="memory-agent-facts">
                  <span>
                    {a.totalSessions > 0
                      ? t("memory.sessionsCount", { count: a.totalSessions })
                      : t("memory.sessionsUnavailable")}
                  </span>
                  {a.lastSessionAt !== null && (
                    <span>
                      {t("memory.lastActive", {
                        when: relativeTime(a.lastSessionAt),
                      })}
                    </span>
                  )}
                  <span>{a.provider ?? t("memory.providerBuiltIn")}</span>
                  <span>
                    {a.vaultLinked
                      ? t("memory.vaultLinked")
                      : t("memory.vaultNotLinked")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="memory-agent-unavailable">
                {t("memory.agentUnavailable")}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Memory;
