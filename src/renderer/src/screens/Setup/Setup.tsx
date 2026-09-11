import { useState, useEffect } from "react";
import { ArrowRight, ExternalLink, Check } from "../../assets/icons";
import {
  PROVIDERS,
  LOCAL_PRESETS,
  DASHSCOPE_ENDPOINTS,
  OAUTH_PROVIDERS,
} from "../../constants";
import { useI18n } from "../../components/useI18n";
import VerifyWarningBanner from "../../components/VerifyWarningBanner";
import BrandLogo from "../../components/common/BrandLogo";
import SetupModelField from "./SetupModelField";
import OAuthLoginModal from "../../components/OAuthLoginModal";
import { expectedEnvKeyForUrl } from "../../../../shared/url-key-map";

interface SetupProps {
  onComplete: () => void;
  verifyWarning?: boolean;
  onReinstall?: () => void;
  onDismissVerifyWarning?: () => void;
}

function Setup({
  onComplete,
  verifyWarning,
  onReinstall,
  onDismissVerifyWarning,
}: SetupProps): React.JSX.Element {
  const { t } = useI18n();
  const [selectedProvider, setSelectedProvider] = useState("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [modelName, setModelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);

  const provider = PROVIDERS.setup.find((p) => p.id === selectedProvider)!;
  const isLocal = selectedProvider === "local";
  const isDashScope = selectedProvider === "alibaba";
  // Hoisted out of handleContinue: the model field needs the same pair to ask
  // the provider for its catalog.
  const configProvider = isLocal ? "custom" : provider.configProvider;
  const configBaseUrl =
    isLocal || isDashScope ? baseUrl.trim() : provider.baseUrl;

  // OAuth-only tiles (Codex) have no key to type: the CLI's browser sign-in
  // is the credential. Setup used to wave these through, so a fresh user
  // landed in chat with "run hermes auth" errors and no sign-in in sight.
  const oauthProvider = OAUTH_PROVIDERS.find((o) => o.id === configProvider);
  const [oauthSignedIn, setOauthSignedIn] = useState(false);
  const [oauthOpen, setOauthOpen] = useState(false);
  useEffect(() => {
    if (!oauthProvider || oauthOpen) return;
    let live = true;
    setOauthSignedIn(false);
    // Re-runs when the modal closes; auth.json is the source of truth, not
    // the modal's own success flag.
    void window.hermesAPI
      .getOAuthProviderStatuses()
      .then((s) => live && setOauthSignedIn(!!s[oauthProvider.id]))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [oauthProvider, oauthOpen]);

  function applyLocalPreset(presetBaseUrl: string): void {
    setBaseUrl(presetBaseUrl);
  }

  function pickProvider(id: string): void {
    setSelectedProvider(id);
    // A model id from the previous provider means nothing to this one.
    setModelName("");
    setError("");
  }

  // Setup prefers a LOCAL_PRESETS exact-URL match (so e.g. an LM Studio
  // preset's explicit `envKey` wins over URL pattern matching), then
  // falls back to the shared URL_KEY_MAP for known commercial hosts and
  // finally to `CUSTOM_API_KEY` for unknown URLs.
  function resolveCustomEnvKey(url: string): string {
    const preset = LOCAL_PRESETS.find((p) => p.baseUrl === url);
    if (preset?.envKey) return preset.envKey;
    return expectedEnvKeyForUrl(url);
  }

  async function handleContinue(): Promise<void> {
    if (provider.needsKey && !apiKey.trim()) {
      setError(t("setup.missingApiKey"));
      return;
    }
    if ((isLocal || isDashScope) && !baseUrl.trim()) {
      setError(t("setup.missingServerUrl"));
      return;
    }
    // Setup used to finish with an empty model, which wrote `default: ""` and
    // dropped the user straight into the "No model selected" banner.
    if (!modelName.trim()) {
      setError(t("setup.missingModel"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (provider.needsKey && provider.envKey) {
        await window.hermesAPI.setEnv(provider.envKey, apiKey.trim());
      } else if (isLocal && apiKey.trim()) {
        const envKey = resolveCustomEnvKey(baseUrl.trim());
        await window.hermesAPI.setEnv(envKey, apiKey.trim());
      }

      const configModel = modelName.trim();
      await window.hermesAPI.setModelConfig(
        configProvider,
        configModel,
        configBaseUrl,
      );

      onComplete();
    } catch {
      setError(t("setup.saveFailed"));
      setSaving(false);
    }
  }

  return (
    <div className="screen setup-screen">
      {verifyWarning && onReinstall && onDismissVerifyWarning && (
        <VerifyWarningBanner
          onReinstall={onReinstall}
          onDismiss={onDismissVerifyWarning}
        />
      )}
      <div className="setup-panel">
        <h1 className="setup-title">{t("setup.title")}</h1>
        <p className="setup-subtitle">{t("setup.subtitle")}</p>

        <div className="setup-provider-grid">
          {PROVIDERS.setup.map((p) => {
            const active = selectedProvider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                className={`setup-provider-card ${active ? "selected" : ""}`}
                onClick={() => {
                  pickProvider(p.id);
                  if (p.id === "alibaba") {
                    setBaseUrl(p.baseUrl);
                  }
                }}
              >
                {active && (
                  <span className="setup-provider-check" aria-hidden="true">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
                <span className="setup-provider-logo">
                  <BrandLogo provider={p.id} size={22} matchTheme={true} />
                </span>
                <span className="setup-provider-name">{t(p.name)}</span>
              </button>
            );
          })}
        </div>

        <div className="setup-form">
          {isLocal ? (
            <>
              <label className="setup-label">
                {t("setup.localGroupLabel")}
              </label>
              <div className="setup-local-presets">
                {LOCAL_PRESETS.filter((p) => p.group === "local").map(
                  (preset) => (
                    <button
                      key={preset.id}
                      className={`setup-local-preset ${baseUrl === preset.baseUrl ? "active" : ""}`}
                      onClick={() => applyLocalPreset(preset.baseUrl)}
                    >
                      <BrandLogo
                        provider={preset.id}
                        size={16}
                        matchTheme={true}
                      />
                      <span>{t(`setup.localPresets.${preset.id}`)}</span>
                    </button>
                  ),
                )}
              </div>

              <label className="setup-label" style={{ marginTop: 12 }}>
                {t("setup.remoteGroupLabel")}
              </label>
              <div className="setup-local-presets">
                {LOCAL_PRESETS.filter((p) => p.group === "remote").map(
                  (preset) => (
                    <button
                      key={preset.id}
                      className={`setup-local-preset ${baseUrl === preset.baseUrl ? "active" : ""}`}
                      onClick={() => applyLocalPreset(preset.baseUrl)}
                    >
                      <BrandLogo
                        provider={preset.id}
                        size={16}
                        matchTheme={true}
                      />
                      <span>{t(`setup.localPresets.${preset.id}`)}</span>
                    </button>
                  ),
                )}
              </div>

              <label className="setup-label" style={{ marginTop: 16 }}>
                {t("setup.serverUrl")}
              </label>
              <input
                className="input"
                type="text"
                placeholder={t("setup.modelBaseUrlPlaceholder")}
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setError("");
                }}
                autoFocus
              />
              <div className="setup-field-hint">
                {t("setup.customServerHint")}
              </div>

              <label className="setup-label" style={{ marginTop: 16 }}>
                {t("setup.customApiKeyLabel")}{" "}
                <span className="setup-label-optional">
                  {t("common.optional")}
                </span>
              </label>
              <div className="setup-input-group">
                <input
                  className="input"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setError("");
                  }}
                />
                <button
                  className="setup-toggle-visibility"
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? t("common.hide") : t("common.show")}
                </button>
              </div>
              <div className="setup-field-hint">
                {t("setup.customApiKeyHint")}
              </div>

              <SetupModelField
                provider={configProvider}
                baseUrl={configBaseUrl}
                apiKey={apiKey.trim() || undefined}
                value={modelName}
                onChange={(m) => {
                  setModelName(m);
                  setError("");
                }}
              />
            </>
          ) : provider.needsKey ? (
            <>
              {isDashScope && (
                <>
                  <label className="setup-label">
                    {t("constants.dashscopeEndpoint")}
                  </label>
                  <select
                    className="input"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setError("");
                    }}
                  >
                    {DASHSCOPE_ENDPOINTS.map((endpoint) => (
                      <option key={endpoint.id} value={endpoint.baseUrl}>
                        {t(endpoint.name)}
                      </option>
                    ))}
                  </select>
                  <div className="setup-field-hint">
                    {t("setup.customServerHint")}
                  </div>
                </>
              )}

              <label
                className="setup-label"
                style={isDashScope ? { marginTop: 16 } : undefined}
              >
                {t("setup.apiKeyLabel", { provider: t(provider.name) })}
              </label>
              <div className="setup-input-group">
                <input
                  className="input"
                  type={showKey ? "text" : "password"}
                  placeholder={provider.placeholder}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                  autoFocus
                />
                <button
                  className="setup-toggle-visibility"
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  {showKey ? t("common.hide") : t("common.show")}
                </button>
              </div>

              <button
                className="setup-link"
                onClick={() => window.hermesAPI.openExternal(provider.url)}
              >
                {t("setup.noKeyHint")}
                <ExternalLink size={12} />
              </button>

              <SetupModelField
                provider={configProvider}
                baseUrl={configBaseUrl}
                apiKey={apiKey.trim() || undefined}
                value={modelName}
                onChange={(m) => {
                  setModelName(m);
                  setError("");
                }}
              />
            </>
          ) : oauthProvider ? (
            <>
              <div className="setup-field-hint">
                {t("setup.oauthHint", { provider: oauthProvider.name })}
              </div>
              <div className="setup-oauth-row">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOauthOpen(true)}
                >
                  {t("setup.oauthSignIn")}
                </button>
                <span className="setup-field-hint">
                  {oauthSignedIn
                    ? t("setup.oauthSignedIn")
                    : t("setup.oauthNotSignedIn")}
                </span>
              </div>

              <SetupModelField
                provider={configProvider}
                baseUrl={configBaseUrl}
                value={modelName}
                onChange={(m) => {
                  setModelName(m);
                  setError("");
                }}
              />
            </>
          ) : (
            <>
              <div className="setup-field-hint">
                {t("setup.noApiKeyRequired", { provider: t(provider.name) })}
              </div>

              <SetupModelField
                provider={configProvider}
                baseUrl={configBaseUrl}
                apiKey={apiKey.trim() || undefined}
                value={modelName}
                onChange={(m) => {
                  setModelName(m);
                  setError("");
                }}
              />
            </>
          )}

          {error && <div className="setup-error">{error}</div>}

          <button
            className="btn btn-primary setup-continue"
            onClick={handleContinue}
            disabled={
              saving ||
              !modelName.trim() ||
              (provider.needsKey && !apiKey.trim()) ||
              (!!oauthProvider && !oauthSignedIn) ||
              ((isLocal || isDashScope) && !baseUrl.trim())
            }
            style={{ marginTop: isLocal ? 20 : 0 }}
          >
            {saving ? t("setup.saving") : t("setup.continue")}
            {!saving && <ArrowRight size={16} />}
          </button>
        </div>
        {oauthOpen && oauthProvider && (
          <OAuthLoginModal
            provider={oauthProvider.id}
            providerLabel={oauthProvider.name}
            onClose={() => setOauthOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default Setup;
