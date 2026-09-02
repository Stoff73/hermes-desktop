export default {
  title: "Configuration health",
  description:
    "Audit of the desktop's configuration (env vars, config.yaml, models). Surfaces inconsistencies that commonly cause chat to fail, with one-click fixes where it's safe to apply them automatically.",
  rerun: "Re-run audit",
  allGood: "No issues detected. Your configuration looks consistent.",
  banner: {
    lead: "Configuration issues detected:",
    errors: "{{count}} error(s)",
    warnings: "{{count}} warning(s)",
    infos: "{{count}} note(s)",
    showDetails: "Show details",
  },
  apiKeyBanner: {
    lead: "Local gateway key not set — chat will fail.",
    setNow: "SET NOW",
  },
  apiKeyModal: {
    title: "Set local gateway key",
    description:
      "This is not a provider API key — it is a local secret this app shares with the Hermes gateway running on this machine, so the two can authenticate to each other. Nothing leaves your computer, and you do not need an account anywhere to create one. Click Generate and save. If you keep secrets in a vault (KeePassXC, Bitwarden, etc.) and your Hermes `secrets.provider` already points at it, this warning can be ignored — the provider serves the key directly.",
    label: "Local gateway key (API_SERVER_KEY)",
    placeholder: "Click Generate, or type any secret",
    autoGenerate: "Generate",
    hint: "Any random string works — it is only used between this app and your local gateway.",
  },
  fix: {
    apply: "Apply fix",
    running: "Applying…",
    success: "Fix applied.",
    failure: "Fix failed.",
  },
};
