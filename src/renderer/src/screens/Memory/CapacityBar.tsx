interface CapacityBarProps {
  used: number;
  limit: number;
  label: string;
  /**
   * "neutral" suppresses the error/warning colour ramp: a bounded curated
   * store at capacity is its normal steady state — the agent consolidates on
   * the next write — so it must not read as a fault. Default keeps today's
   * ramp for other callers.
   */
  tone?: "ramp" | "neutral";
}

export function CapacityBar({
  used,
  limit,
  label,
  tone = "ramp",
}: CapacityBarProps): React.JSX.Element {
  // limit is 0 for an agent whose stores could not be read; avoid NaN%.
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color =
    tone === "neutral"
      ? "var(--accent)"
      : pct > 90
        ? "var(--error)"
        : pct > 70
          ? "var(--warning)"
          : "var(--success)";
  return (
    <div className="memory-capacity">
      <div className="memory-capacity-header">
        {label && <span className="memory-capacity-label">{label}</span>}
        <span className="memory-capacity-value">
          {used.toLocaleString()} / {limit.toLocaleString()} chars ({pct}%)
        </span>
      </div>
      <div className="memory-capacity-track">
        <div
          className="memory-capacity-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
