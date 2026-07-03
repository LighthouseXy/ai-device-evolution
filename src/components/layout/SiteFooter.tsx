import Link from "next/link";

export default function SiteFooter() {

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <Link href="/" className="site-footer-logo" aria-label="返回首页">
              <span className="site-nav-mark" aria-hidden="true" />
              <span className="site-footer-title">数码观察站</span>
            </Link>
            <p className="site-footer-desc">
              聚焦电子设备代际演进、规格对比与 AI 辅助分析的研究平台。当前阶段以 Apple 样本为第一阶段范围，
              后续会逐步扩展到更多品牌与品类。
            </p>
          </div>

          <div className="site-footer-links">
            <div className="site-footer-columns">
              <div className="site-footer-col">
                <div className="site-footer-col-title">导航</div>
                <Link className="site-footer-link" href="/">首页</Link>
                <Link className="site-footer-link" href="/advisor">AI 顾问</Link>
                <Link className="site-footer-link" href="/compare">代际对比</Link>
                <Link className="site-footer-link" href="/trends">趋势观察</Link>
                <Link className="site-footer-link" href="/devices">设备库</Link>
              </div>
              <div className="site-footer-col">
                <div className="site-footer-col-title">定位</div>
                <span className="site-footer-link">数码观察站</span>
                <span className="site-footer-link">电子设备代际演进分析平台</span>
              </div>
            </div>
          </div>
        </div>

        <div className="site-footer-bottom">
          <div className="site-footer-note">
            Apple 仅作为第一阶段样本范围，页面与数据结构会优先保持对多品牌、多品类的可扩展性。
          </div>
          <div className="site-footer-chip">
            <span aria-hidden="true">◎</span>
            Design System v2
          </div>
        </div>
      </div>
    </footer>
  );
}
