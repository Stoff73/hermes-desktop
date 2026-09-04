import { useState } from "react";
import { useI18n } from "../../components/useI18n";

interface MemoryVaultProps {
  path: string | null;
  exists: boolean;
  profile?: string;
  onRefresh: () => void;
}

/**
 * Detail pane for the Obsidian vault row. The desktop only ever writes the
 * path (OBSIDIAN_VAULT_PATH in this agent's .env); the agent's note-taking
 * skill reads and writes the notes. Unlinking removes the variable outright
 * so no blank line is left for the skill to misread.
 */
export function MemoryVault({
  path,
  exists,
  profile,
  onRefresh,
}: MemoryVaultProps): React.JSX.Element {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function apply(write: () => Promise<boolean>): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const ok = await write();
      if (!ok) setError(t("memory.saveFailed"));
      onRefresh();
    } catch {
      setError(t("memory.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function choose(): Promise<void> {
    const picked = await window.hermesAPI.selectFolder();
    if (!picked) return;
    await apply(() =>
      window.hermesAPI.setEnv("OBSIDIAN_VAULT_PATH", picked, profile),
    );
  }

  async function unlink(): Promise<void> {
    await apply(() =>
      window.hermesAPI.removeEnv("OBSIDIAN_VAULT_PATH", profile),
    );
  }

  return (
    <div className="memory-vault">
      <h4 className="memory-vault-title">{t("memory.vaultTitle")}</h4>
      <p className="memory-vault-hint">{t("memory.vaultHint")}</p>
      {error && <div className="memory-error">{error}</div>}
      <div className="memory-vault-path" data-testid="memory-vault-path">
        <code>{path ?? t("memory.vaultNotLinked")}</code>
        {path && !exists && (
          <span className="memory-system-warn">{t("memory.vaultMissing")}</span>
        )}
      </div>
      <div className="memory-vault-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void choose()}
          disabled={saving}
        >
          {t("memory.vaultChoose")}
        </button>
        {path && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void unlink()}
            disabled={saving}
          >
            {t("memory.vaultClear")}
          </button>
        )}
      </div>
      <div className="memory-system-note">{t("memory.nextSessionNote")}</div>
    </div>
  );
}
