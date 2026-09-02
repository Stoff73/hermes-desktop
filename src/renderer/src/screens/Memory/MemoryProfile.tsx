import { useEffect, useState } from "react";
import { useI18n } from "../../components/useI18n";

interface MemoryProfileProps {
  content: string;
  charLimit: number;
  profile?: string;
  onRefresh: () => void;
}

export function MemoryProfile({
  content: initialContent,
  charLimit,
  profile,
  onRefresh,
}: MemoryProfileProps): React.JSX.Element {
  const { t } = useI18n();
  const [userContent, setUserContent] = useState(initialContent);
  const [userEditing, setUserEditing] = useState(false);
  const [userSaved, setUserSaved] = useState(false);
  const [error, setError] = useState("");

  // Resync to disk when a refresh delivers new content and the user is not
  // mid-edit. After a conflict the draft survives (userEditing stays true) but
  // `initialContent` has moved on, so the next save's expectation is the
  // fresh file — an informed overwrite, not a silent one.
  useEffect(() => {
    if (!userEditing) setUserContent(initialContent);
  }, [initialContent, userEditing]);

  async function handleSave(): Promise<void> {
    setError("");
    const result = await window.hermesAPI.writeUserProfile(
      userContent,
      profile,
      initialContent,
    );
    if (result.success) {
      setUserEditing(false);
      setUserSaved(true);
      setTimeout(() => setUserSaved(false), 2000);
      onRefresh();
    } else {
      setError(result.error || t("memory.saveFailed"));
      if (result.conflict) onRefresh();
    }
  }

  return (
    <div className="memory-profile">
      <div className="memory-profile-header">
        <span className="memory-profile-hint">
          {t("memory.userProfileHint")}
        </span>
        {userSaved && (
          <span
            style={{
              color: "var(--success)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {t("common.saved")}
          </span>
        )}
      </div>

      {error && (
        <div className="memory-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <textarea
        className="memory-profile-textarea"
        value={userContent}
        onChange={(e) => {
          setUserContent(e.target.value);
          setUserEditing(true);
        }}
        placeholder={t("memory.userProfilePlaceholder")}
        rows={8}
      />
      <div className="memory-profile-footer">
        <span className="memory-entry-chars">
          {t("memory.chars", { count: userContent.length })} / {charLimit}{" "}
          {t("memory.chars", { count: 1 }).split(" ")[1]}
        </span>
        {userEditing && (
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            {t("memory.saveProfile")}
          </button>
        )}
      </div>
    </div>
  );
}
