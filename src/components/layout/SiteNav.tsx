"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/advisor", label: "AI 顾问" },
  { href: "/compare", label: "代际对比" },
  { href: "/trends", label: "趋势观察" },
  { href: "/devices", label: "设备库" },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand" aria-label="返回首页">
          <span className="site-nav-mark" aria-hidden="true" />
          <span className="site-nav-name">数码观察站</span>
        </Link>

        <div className="site-nav-links">
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`site-nav-link${active ? " site-nav-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="site-nav-link-label">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <form action="/devices" method="get" className="site-nav-search" role="search">
          <input name="q" type="search" placeholder="搜索设备…" aria-label="搜索设备" />
          <button type="submit" aria-label="搜索设备">
            ⌘K
          </button>
        </form>
      </div>
    </nav>
  );
}
