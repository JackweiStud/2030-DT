/**
 * 2D 选中、3D 可见禁用。不引入 Three.js。
 */

export function ViewModeToggle() {
  return (
    <div className="c4-view-toggle" data-region="ViewModeToggle">
      <span className="c4-view-toggle__item is-active">2D视图</span>
      <span className="c4-view-toggle__item is-disabled" aria-disabled="true">
        3D视图
      </span>
    </div>
  );
}
