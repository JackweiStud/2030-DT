/**
 * 三方案图例，首版不可点显隐。
 */

export function TrackLegend() {
  return (
    <div className="c4-legend" data-region="TrackLegend" aria-hidden="true">
      <div className="c4-legend__item">
        <i className="c4-legend__swatch c4-legend__swatch--bs" />
        <span>传统基站定位</span>
      </div>
      <div className="c4-legend__item">
        <i className="c4-legend__swatch c4-legend__swatch--gaode" />
        <span>商用方案定位</span>
      </div>
      <div className="c4-legend__item">
        <i className="c4-legend__swatch c4-legend__swatch--dt" />
        <span>数字孪生辅助定位</span>
      </div>
    </div>
  );
}
