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
              聚焦电子设备代际演进、规格对比与 AI 辅助分析的研究平台，
              已从 Apple 扩展到 Xiaomi、OPPO、vivo 与 Huawei 中国大陆产品线试点。
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
            多品牌数据按中国大陆市场、明确配置和可追溯来源持续扩充。
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
