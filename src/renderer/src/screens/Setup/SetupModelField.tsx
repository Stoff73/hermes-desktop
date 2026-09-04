import { useEffect, useState } from "react";
import { useI18n } from "../../components/useI18n";

interface SetupModelFieldProps {
  /** Config provider id, e.g. "openai-codex", "anthropic", "custom". */
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  value: string;
  onChange: (model: string) => void;
}

/**
 * The model chooser on the first-run screen, scoped to the provider that was
 * just picked — an Anthropic user is offered Anthropic's models and nothing
 * else.
 *
 * Discovery can fail for good reasons (no key yet, an unreachable custom
 * endpoint, a provider with no catalog endpoint), and setup now refuses to
 * finish without a model, so a failure must never be a dead end: the field
 * degrades to the free-text box it used to be.
 */
export default function SetupModelField({
  provider,
  baseUrl,
  apiKey,
  value,
  onChange,
}: SetupModelFieldProps): React.JSX.Element {
  const { t } = useI18n();
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setModels([]);
    // Keys are typed a character at a time; without this every keystroke
    // would fire a catalog request.
    const timer = setTimeout(() => {
      setLoading(true);
      void window.hermesAPI
        .discoverProviderModels(provider, baseUrl, apiKey)
        .then((r) => {
          if (!live) return;
          setModels(r.status === "ok" ? r.models : []);
        })
        .catch(() => live && setModels([]))
        .finally(() => live && setLoading(false));
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [provider, baseUrl, apiKey]);

  return (
    <>
      <label className="setup-label" style={{ marginTop: 16 }}>
        {t("setup.modelName")}
      </label>
      {loading ? (
        <div className="setup-field-hint" data-testid="setup-model-loading">
          {t("setup.modelLoading")}
        </div>
      ) : models.length > 0 ? (
        <>
          <select
            className="input"
            data-testid="setup-model-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{t("setup.modelChoose")}</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="setup-field-hint">{t("setup.modelScopedHint")}</div>
        </>
      ) : (
        <>
          <input
            className="input"
            type="text"
            data-testid="setup-model-input"
            placeholder={t("setup.modelNamePlaceholder")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="setup-field-hint">{t("setup.modelUnlistedHint")}</div>
        </>
      )}
    </>
  );
}
