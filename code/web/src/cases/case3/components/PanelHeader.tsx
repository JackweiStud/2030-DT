/**
 * Case3 上区标题：测试对比 + 现场环境入口。
 * 现场环境只回调 Shell，不复制弹层。
 */

type Props = {
  onOpenSiteEnv: () => void;
};

/**
 * 测试对比面板标题行。
 */
export function PanelHeader(props: Props) {
  return (
    <div className="case3-panel-title-row">
      <div className="case3-title-group">
        <span className="case3-title-accent" aria-hidden />
        <h2 className="case3-panel-title">测试对比</h2>
      </div>
      <a
        className="case3-env-link"
        href="#现场环境"
        onClick={(e) => {
          e.preventDefault();
          props.onOpenSiteEnv();
        }}
      >
        现场环境 &gt;
      </a>
    </div>
  );
}
