"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getRememberedPage, rememberCurrentPage } from "@/lib/page-navigation";

const links = [
  { href: "/advisor", label: "AI 顾问" },
  { href: "/compare", label: "产品对比" },
  { href: "/trends", label: "趋势观察" },
  { href: "/devices", label: "设备库" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    rememberCurrentPage();
    // 包含目录本地 pushState 筛选和进入详情的链接，不只记录服务端路由变化。
    document.addEventListener("click", rememberCurrentPage, true);
    window.addEventListener("pagehide", rememberCurrentPage);
    return () => {
      document.removeEventListener("click", rememberCurrentPage, true);
      window.removeEventListener("pagehide", rememberCurrentPage);
    };
  }, [pathname]);

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
                onNavigate={event => {
                  event.preventDefault();
                  rememberCurrentPage();
                  const href = getRememberedPage(link.href);
                  if (window.location.pathname + window.location.search !== href) router.push(href);
                }}
              >
                <span className="site-nav-link-label">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <form action="/devices" method="get" className="site-nav-search" role="search" onSubmit={event => {
          event.preventDefault();
          const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
          const href = `/devices${q ? `?${new URLSearchParams({ q })}` : ""}`;
          if (pathname === "/devices") window.history.pushState(null, "", href);
          else router.push(href);
        }}>
          <input name="q" type="search" placeholder="搜索设备…" aria-label="搜索设备" />
          <button type="submit" aria-label="搜索设备">
            ⌘K
          </button>
        </form>
      </div>
    </nav>
  );
}
