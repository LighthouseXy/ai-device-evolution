export const NAVIGATION_PAGES = ["/advisor", "/compare", "/trends", "/devices"] as const;

export function rememberedPageHref(page: string, saved: string | null) {
  // 只恢复当前站点的同一一级页面；不接受外部地址或设备详情地址。
  if (!NAVIGATION_PAGES.some(path => path === page) || !saved) return page;
  return saved === page || saved.startsWith(`${page}?`) ? saved : page;
}

export function rememberCurrentPage() {
  const { pathname, search } = window.location;
  if (!NAVIGATION_PAGES.some(page => page === pathname)) return;
  try { window.sessionStorage.setItem(`navigation:${pathname}`, pathname + search); } catch { /* 禁用存储不影响导航。 */ }
}

export function getRememberedPage(page: string) {
  try { return rememberedPageHref(page, window.sessionStorage.getItem(`navigation:${page}`)); }
  catch { return page; }
}
