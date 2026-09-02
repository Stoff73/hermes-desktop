import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../useI18n";
import { useModelConfig } from "../../screens/Chat/hooks/useModelConfig";
import { ModelPicker } from "../../screens/Chat/ModelPicker";

interface ProfileModelPickerProps {
  /** Profile id. The pick is saved to this agent's own config.yaml. */
  profile: string;
}

interface KeyIssue {
  expectedKey: string;
  provider: string;
}

/** The slice of ConfigHealthReport this component reads. */
interface HealthReportLike {
  issues?: { code: string; context?: Record<string, string> }[];
}

/**
 * Per-agent model and provider, in Agent Settings → Profile.
 *
 * Reuses the chat's model hook and picker in persist mode, so a pick here is
 * durable for this agent (unlike the chat's session-only override). After
 * each pick the existing per-profile config health check runs; when it
 * reports MODEL_KEY_MISSING the user can paste that key straight into this
 * agent's .env. The check already understands OAuth credentials, vaults and
 * compatible-endpoint fallbacks, so nothing is re-derived here.
 */
export default function ProfileModelPicker({
  profile,
}: ProfileModelPickerProps): React.JSX.Element {
  const { t } = useI18n();
  const mc = useModelConfig(profile);
  const [keyIssue, setKeyIssue] = useState<KeyIssue | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const checkKey = useCallback(async (): Promise<void> => {
    try {
      const report = (await window.hermesAPI.rerunConfigHealth(
        profile,
      )) as HealthReportLike;
      const issue = report?.issues?.find((i) => i.code === "MODEL_KEY_MISSING");
      const expectedKey = issue?.context?.expectedKey;
      setKeyIssue(
        expectedKey
          ? { expectedKey, provider: issue?.context?.provider ?? "" }
          : null,
      );
    } catch {
      // A failed check never blocks the picker; the hint is simply omitted.
      setKeyIssue(null);
    }
  }, [profile]);

  useEffect(() => {
    void checkKey();
  }, [checkKey, mc.currentModel, mc.currentProvider]);

  async function handleSelect(
    provider: string,
    model: string,
    baseUrl: string,
  ): Promise<void> {
    setError("");
    try {
      await mc.selectModel(provider, model, baseUrl, { persist: true });
    } catch {
      setError(t("common.updateFailed"));
    }
  }

  async function saveKey(): Promise<void> {
    if (!keyIssue || !keyDraft.trim()) return;
    setSaving(true);
    setError("");
    try {
      const ok = await window.hermesAPI.setEnv(
        keyIssue.expectedKey,
        keyDraft.trim(),
        profile,
      );
      if (!ok) setError(t("common.updateFailed"));
      setKeyDraft("");
      await checkKey();
    } catch {
      setError(t("common.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-modal-section profile-model">
      <span className="profile-modal-label">{t("agents.modelLabel")}</span>
      <p className="profile-model-hint">{t("agents.modelHint")}</p>
      <ModelPicker
        active={false}
        currentModel={mc.currentModel}
        currentProvider={mc.currentProvider}
        currentBaseUrl={mc.currentBaseUrl}
        modelGroups={mc.modelGroups}
        displayModel={mc.displayModel}
        onOpen={() => void mc.reload()}
        onSelectModel={(p, m, b) => void handleSelect(p, m, b)}
      />
      {keyIssue && (
        <div className="profile-model-key" data-testid="profile-model-key">
          <span className="profile-model-hint">
            {t("agents.modelKeyMissing", { key: keyIssue.expectedKey })}
          </span>
          <div className="profile-model-key-row">
            <input
              className="input"
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder={keyIssue.expectedKey}
              aria-label={keyIssue.expectedKey}
              disabled={saving}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!keyDraft.trim() || saving}
              onClick={() => void saveKey()}
            >
              {t("memory.save")}
            </button>
          </div>
          <span className="profile-model-hint">
            {t("agents.modelKeyOAuthHint")}
          </span>
        </div>
      )}
      {error && <div className="agents-create-error">{error}</div>}
    </div>
  );
}
