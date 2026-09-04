import { useState } from "react";
import { Database, User, Search, Cloud } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useI18n } from "../../components/useI18n";
import { CapacityBar } from "./CapacityBar";
import { MemoryEntries } from "./MemoryEntries";
import { MemoryProfile } from "./MemoryProfile";
import { MemoryProviders } from "./MemoryProviders";
import { MemoryVault } from "./MemoryVault";
import type { MemoryData, MemoryProviderInfo } from "./types";

type SystemKey = "memory" | "user" | "sessions" | "provider";

interface MemorySystemsProps {
  data: MemoryData;
  profile?: string;
  /**
   * From discoverMemoryProviders(profile). An empty array makes
   * MemoryProviders render "No memory providers found in this installation",
   * so the caller must fetch these — deliberately required, not optional.
   */
  providers: MemoryProviderInfo[];
  /** Display name for the rows that speak about the agent. Falls back to the id. */
  agentName?: string;
  onRefresh: () => void;
}

const NEAR_FULL = 0.9;

/** Last path segment of a vault path, for the row metric. */
function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** "3 hours ago" from unix seconds; "" when the timestamp is unusable. */
export function relativeTime(unixSeconds: number): string {
  try {
    return formatDistanceToNowStrict(unixSeconds * 1000, { addSuffix: true });
  } catch {
    return "";
  }
}

interface SystemRow {
  key: SystemKey;
  Icon: typeof Database;
  label: string;
  desc: string;
  /** What you can actually do to this system, already localised. */
  badge: string;
  /** Bounded stores get a capacity bar and the at-capacity caption. */
  bounded: boolean;
  used: number;
  limit: number;
  metric: React.ReactNode;
  detail: React.ReactNode;
}

export function MemorySystems({
  data,
  profile,
  providers,
  agentName,
  onRefresh,
}: MemorySystemsProps): React.JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState<SystemKey | null>(null);
  // Prefer the display name; the id is a slug and reads badly in a sentence.
  const who = agentName ?? profile;

  const rows: SystemRow[] = [
    {
      key: "memory",
      Icon: Database,
      label: t("memory.agentMemory"),
      desc: t("memory.agentMemoryDesc"),
      badge: t("memory.editable"),
      bounded: true,
      used: data.memory.charCount,
      limit: data.memory.charLimit,
      metric: (
        <CapacityBar
          used={data.memory.charCount}
          limit={data.memory.charLimit}
          label=""
          tone="neutral"
        />
      ),
      detail: (
        <MemoryEntries
          entries={data.memory.entries}
          profile={profile}
          onRefresh={onRefresh}
        />
      ),
    },
    {
      key: "user",
      Icon: User,
      label: who
        ? t("memory.userProfileOf", { agent: who })
        : t("memory.userProfile"),
      desc: t("memory.userProfileDesc"),
      badge: t("memory.editable"),
      bounded: true,
      used: data.user.charCount,
      limit: data.user.charLimit,
      metric: (
        <CapacityBar
          used={data.user.charCount}
          limit={data.user.charLimit}
          label=""
          tone="neutral"
        />
      ),
      detail: (
        <MemoryProfile
          content={data.user.content}
          charLimit={data.user.charLimit}
          profile={profile}
          onRefresh={onRefresh}
        />
      ),
    },
    {
      key: "sessions",
      Icon: Search,
      label: t("memory.sessionSearch"),
      desc: t("memory.sessionSearchDesc"),
      // Written entirely by the agent.
      badge: t("memory.readOnly"),
      bounded: false,
      used: 0,
      limit: 0,
      metric: data.sessions.available ? (
        <span className="memory-system-facts">
          <span>
            {t("memory.sessionsAndMessages", {
              sessions: data.sessions.totalSessions,
              messages: data.sessions.totalMessages,
            })}
          </span>
          {data.sessions.lastSessionAt !== null && (
            <span>
              {t("memory.lastActive", {
                when: relativeTime(data.sessions.lastSessionAt),
              })}
            </span>
          )}
        </span>
      ) : (
        <span>{t("memory.sessionsUnavailable")}</span>
      ),
      // Deliberately thin: search lives on the Sessions screen, which already
      // implements FTS over the same table.
      detail: (
        <div className="memory-system-detail-note">
          {data.sessions.available
            ? t("memory.sessionsAndMessages", {
                sessions: data.sessions.totalSessions,
                messages: data.sessions.totalMessages,
              })
            : t("memory.sessionsUnavailable")}
          {data.sessions.lastSessionAt !== null && (
            <>
              {" · "}
              {t("memory.lastActive", {
                when: relativeTime(data.sessions.lastSessionAt),
              })}
            </>
          )}
          <br />
          {t("memory.sessionSearchHint")}
        </div>
      ),
    },
    {
      key: "provider",
      Icon: Cloud,
      label: t("memory.providersTitle"),
      desc: t("memory.providerDesc"),
      // Providers and the Obsidian vault are both external stores you point
      // the agent at but cannot read or write from here, so they share a card.
      // "Read-only" beside their own Activate/Choose buttons would be a lie.
      badge: t("memory.configurable"),
      bounded: false,
      used: 0,
      limit: 0,
      metric: (
        <span className="memory-system-facts">
          <span>
            {data.provider.active ?? t("memory.providerBuiltIn")}
            {data.provider.active && !data.provider.installed && (
              <span className="memory-system-warn">
                {t("memory.providerNotInstalled")}
              </span>
            )}
          </span>
          <span>
            {data.vault.path
              ? folderName(data.vault.path)
              : t("memory.vaultNotLinked")}
            {data.vault.path && !data.vault.exists && (
              <span className="memory-system-warn">
                {t("memory.vaultMissing")}
              </span>
            )}
          </span>
        </span>
      ),
      detail: (
        <>
          <MemoryProviders
            providers={providers}
            activeProvider={data.provider.active}
            profile={profile}
            onRefresh={onRefresh}
          />
          <MemoryVault
            path={data.vault.path}
            exists={data.vault.exists}
            profile={profile}
            onRefresh={onRefresh}
          />
        </>
      ),
    },
  ];

  return (
    <div className="memory-systems">
      {rows.map((r) => {
        const isOpen = open === r.key;
        const nearFull =
          r.bounded && r.limit > 0 && r.used / r.limit >= NEAR_FULL;
        return (
          <div
            className={`memory-system ${isOpen ? "is-open" : ""}`}
            key={r.key}
            data-testid={`memory-system-${r.key}`}
          >
            <button
              type="button"
              className="memory-system-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : r.key)}
            >
              <r.Icon size={15} className="memory-system-icon" />
              <span className="memory-system-text">
                <span className="memory-system-label">{r.label}</span>
                <span className="memory-system-desc">{r.desc}</span>
              </span>
              <span className="memory-system-badge">{r.badge}</span>
              <span className="memory-system-metric">{r.metric}</span>
            </button>
            {nearFull && (
              <div className="memory-system-note">{t("memory.atCapacity")}</div>
            )}
            {isOpen && (
              <div className="memory-system-detail">
                {r.detail}
                {r.bounded && (
                  <div className="memory-system-note">
                    {t("memory.nextSessionNote")}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
