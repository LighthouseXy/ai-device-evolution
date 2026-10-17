export default function Loading() {
  return <main className="site-main" aria-busy="true"><div className="site-container py-16">
    <p role="status" className="text-[var(--primary)]">正在加载页面…</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2" aria-hidden="true">
      <div className="h-56 rounded-2xl bg-[var(--bg-soft)]" /><div className="h-56 rounded-2xl bg-[var(--bg-soft)]" />
    </div>
  </div></main>;
}
