/**
 * 2D 选中、3D 可见禁用。不引入 Three.js。
 */

export function ViewModeToggle() {
  return (
    <div className="case3v2-view-toggle" data-region="ViewModeToggle">
      <span className="case3v2-view-toggle__item is-active" aria-current="true">
        2D视图
      </span>
      <span
        className="case3v2-view-toggle__item is-disabled"
        aria-disabled="true"
      >
        3D视图
      </span>
    </div>
  );
}
