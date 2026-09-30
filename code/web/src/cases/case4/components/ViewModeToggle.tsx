type Props = { value: "2d" | "3d"; onChange: (mode: "2d" | "3d") => void; disabled?: boolean };
export function ViewModeToggle({ value, onChange, disabled }: Props) {
 return <div className="c4-view-toggle" data-region="ViewModeToggle">
  {(["2d", "3d"] as const).map(mode=><button key={mode} type="button" className={`c4-view-toggle__item${value === mode ? " is-active" : ""}`} aria-pressed={value === mode} disabled={disabled} onClick={()=>onChange(mode)}>{mode === "2d" ? "2D视图" : "3D视图"}</button>)}
 </div>;
}
