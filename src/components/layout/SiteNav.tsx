"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "首页" },
  { href: "/devices", label: "设备库" },
  { href: "/dev/device-advisor-eval", label: "AI 评测" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand" aria-label="返回首页">
          <span className="site-nav-mark" aria-hidden="true" />
          <span className="site-nav-brand-copy">
            <span className="site-nav-name">数码观察站</span>
            <span className="site-nav-subtitle">电子设备代际演进分析平台</span>
          </span>
        </Link>

        <div className="site-nav-links">
          {links.map((link) => {
            if (link.href.startsWith("/dev/") && !isDev) {
              return null;
            }

            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`site-nav-link${active ? " site-nav-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          <span className="site-nav-pill" aria-label="样本范围：Apple">
            <span className="site-nav-pill-dot" aria-hidden="true" />
            Apple 样本阶段
          </span>
        </div>
      </div>
    </nav>
  );
}
