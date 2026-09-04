import { useEffect, useState } from "react";
import { useI18n } from "../useI18n";

interface ProfileWorkFolderProps {
  profile?: string;
}

/**
 * Folder picker for `terminal.cwd` — where this agent's terminal and file
 * tools start. The config key already existed and was never exposed; this is
 * only a reader and writer for it. Not a memory setting, hence the Profile tab.
 */
export default function ProfileWorkFolder({
  profile,
}: ProfileWorkFolderProps): React.JSX.Element {
  const { t } = useI18n();
  const [path, setPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void window.hermesAPI
      .getConfig("terminal.cwd", profile)
      .then((v) => live && setPath(v));
    return () => {
      live = false;
    };
  }, [profile]);

  async function write(value: string): Promise<void> {
    setSaving(true);
    const ok = await window.hermesAPI.setConfig("terminal.cwd", value, profile);
    if (ok) setPath(value);
    setSaving(false);
  }

  async function choose(): Promise<void> {
    const picked = await window.hermesAPI.selectFolder();
    if (picked) await write(picked);
  }

  // "." is the config default and means nothing to a reader, so name it.
  const isDefault = path === null || path === "" || path === ".";

  return (
    <div className="profile-modal-section profile-work-folder">
      <span className="profile-modal-label">{t("agents.workFolderLabel")}</span>
      <p className="profile-model-hint">{t("agents.workFolderHint")}</p>
      <div className="profile-work-folder-path">
        <code data-testid="profile-work-folder-path">
          {isDefault ? t("agents.workFolderDefault") : path}
        </code>
      </div>
      <div className="profile-work-folder-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void choose()}
          disabled={saving}
        >
          {t("agents.workFolderChoose")}
        </button>
        {!isDefault && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void write(".")}
            disabled={saving}
          >
            {t("agents.workFolderReset")}
          </button>
        )}
      </div>
    </div>
  );
}
