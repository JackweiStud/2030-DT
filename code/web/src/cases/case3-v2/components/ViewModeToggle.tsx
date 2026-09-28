export function ViewModeToggle({ value = "2d", disabled = false, onChange }: { value?: "2d" | "3d"; disabled?: boolean; onChange?: (mode: "2d" | "3d") => void }) {
  return <div className="case3v2-view-toggle" data-region="ViewModeToggle">
    {(["2d", "3d"] as const).map(mode => <button key={mode} type="button" disabled={disabled} aria-pressed={value === mode} className={`case3v2-view-toggle__item${value === mode ? " is-active" : ""}`} onClick={() => onChange?.(mode)}>{mode.toUpperCase()}视图</button>)}
  </div>;
}
