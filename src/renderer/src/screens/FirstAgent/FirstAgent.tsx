import { useState } from "react";
import { ArrowRight } from "../../assets/icons";
import OnboardHero from "../../components/common/OnboardHero";
import { useI18n } from "../../components/useI18n";
import { GENERAL_PRESET } from "../../../../shared/agent-presets";

export interface FirstAgentHandoff {
  agentName: string;
  purpose: string;
  channels: string[];
}

interface FirstAgentProps {
  onComplete: (handoff: FirstAgentHandoff) => void;
  onSkip: () => void;
}

/** Capability keys in the order they are shown. Labels reuse the Tools screen's
 *  existing strings so the two screens can't describe a capability differently. */
const CAPABILITY_KEYS = [
  "web",
  "browser",
  "file",
  "terminal",
  "code_execution",
  "vision",
  "computer_use",
] as const;

/** Channels offered at first run. Ids match the platform ids the Gateway screen
 *  uses, so the handoff can be passed straight through as a filter. */
export const ONBOARDING_CHANNELS = [
  "email",
  "slack",
  "whatsapp",
  "telegram",
  "discord",
  "signal",
] as const;

function FirstAgent({
  onComplete,
  onSkip,
}: FirstAgentProps): React.JSX.Element {
  const { t } = useI18n();
  const [name, setName] = useState(GENERAL_PRESET.suggestedName);
  const [purpose, setPurpose] = useState("");
  const [toolsets, setToolsets] = useState<Record<string, boolean>>({
    ...GENERAL_PRESET.toolsets,
  });
  const [channels, setChannels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleCapability(key: string): void {
    setToolsets((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleChannel(id: string): void {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleContinue(): Promise<void> {
    const agentName = name.trim();
    if (!agentName) {
      setError(t("setup.firstAgent.nameRequired"));
      return;
    }

    setSaving(true);
    setError("");

    const result = await window.hermesAPI.applyAgentPreset(GENERAL_PRESET.id, {
      name: agentName,
      purpose: purpose.trim(),
      toolsets,
    });

    if (!result.success) {
      setError(result.error || t("setup.firstAgent.nameRequired"));
      setSaving(false);
      return;
    }

    onComplete({ agentName, purpose: purpose.trim(), channels });
  }

  return (
    <OnboardHero
      eyebrow={t("setup.firstAgent.eyebrow")}
      title={t("setup.firstAgent.title")}
    >
      <div className="onboard-first-agent">
        <p className="onboard-subtitle">{t("setup.firstAgent.subtitle")}</p>

        <label className="onboard-field-label" htmlFor="first-agent-name">
          {t("setup.firstAgent.nameLabel")}
        </label>
        <input
          id="first-agent-name"
          className="onboard-input"
          value={name}
          placeholder={t("setup.firstAgent.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="onboard-field-label" htmlFor="first-agent-purpose">
          {t("setup.firstAgent.purposeLabel")}
        </label>
        <input
          id="first-agent-purpose"
          className="onboard-input"
          value={purpose}
          placeholder={t("setup.firstAgent.purposePlaceholder")}
          onChange={(e) => setPurpose(e.target.value)}
        />
        <p className="onboard-note">{t("setup.firstAgent.purposeHint")}</p>

        <p className="onboard-field-label">
          {t("setup.firstAgent.capabilitiesLabel")}
        </p>
        <div className="onboard-capability-grid">
          {CAPABILITY_KEYS.map((key) => (
            <label className="onboard-capability" key={key}>
              <input
                type="checkbox"
                aria-label={t(`tools.${key}.label`)}
                checked={Boolean(toolsets[key])}
                onChange={() => toggleCapability(key)}
              />
              <span className="onboard-capability-name">
                {t(`tools.${key}.label`)}
                {key === "computer_use" && (
                  <span className="onboard-capability-warning">
                    {t("setup.firstAgent.computerUseWarning")}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        <p className="onboard-field-label">
          {t("setup.firstAgent.channelsLabel")}
        </p>
        <div className="onboard-channel-row">
          {ONBOARDING_CHANNELS.map((id) => (
            <label
              className={`onboard-channel-chip${
                channels.includes(id) ? " selected" : ""
              }`}
              key={id}
            >
              <input
                type="checkbox"
                aria-label={t(`setup.firstAgent.channels.${id}`)}
                checked={channels.includes(id)}
                onChange={() => toggleChannel(id)}
              />
              <span>{t(`setup.firstAgent.channels.${id}`)}</span>
            </label>
          ))}
        </div>
        <p className="onboard-note">{t("setup.firstAgent.channelsHint")}</p>

        {error && <p className="onboard-error">{error}</p>}

        <div className="onboard-actions">
          <button
            className="onboard-btn onboard-btn-primary"
            disabled={saving}
            onClick={handleContinue}
          >
            <span>
              {saving
                ? t("setup.firstAgent.saving")
                : t("setup.firstAgent.continue")}
            </span>
            <ArrowRight size={16} />
          </button>
          <button className="onboard-btn" onClick={onSkip}>
            {t("setup.firstAgent.skip")}
          </button>
        </div>
      </div>
    </OnboardHero>
  );
}

export default FirstAgent;
