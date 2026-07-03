import Link from "next/link";
import DeviceAdvisorPanel from "@/components/DeviceAdvisorPanel";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeader from "@/components/layout/SectionHeader";
import TickDivider from "@/components/layout/TickDivider";

const examplePrompts = [
  {
    title: "预算 5000，偏拍照和视频",
    body: "让顾问在真实数据库里筛出更适合影像创作的设备。",
  },
  {
    title: "通勤办公，想要轻一点",
    body: "通过重量、屏幕和续航偏好，收窄到更轻便的样本。",
  },
  {
    title: "只看全新，预算区间明确",
    body: "用预算上下限和成色条件直接生成可执行推荐。",
  },
  {
    title: "iPad 还是 MacBook",
    body: "先让顾问判断任务场景，再由 API 给出权衡点。",
  },
];

function PromptCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">真实示例</div>
          <h3 className="text-lg leading-tight text-[var(--text-strong)]">{title}</h3>
        </div>
        <span className="tag tag-green">API</span>
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{body}</p>
    </div>
  );
}

export default function AdvisorPage() {
  return (
    <main className="site-main">
      <PageHeader
        eyebrow="智能推荐"
        title="AI 顾问"
        description="直接连接真实 `/api/device-advisor`。页面保留可填写预算、偏好和使用场景的完整表单，不使用原型里的假示例数据。"
        actions={
          <>
            <Link href="/devices" className="btn btn-ghost">
              返回设备库
            </Link>
            <Link href="/compare" className="btn btn-primary">
              先看代际对比
            </Link>
          </>
        }
        meta={
          <>
            <span className="tag tag-green">真实表单</span>
            <span className="tag tag-neutral">Apple 样本阶段</span>
            <span className="tag tag-amber">API 直连</span>
          </>
        }
      />

      <section className="section pt-0">
        <div className="section-inner grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-5">
            <div className="card p-5">
              <SectionHeader
                eyebrow="使用方式"
                title="先描述预算和场景，再看推荐"
                description="顾问会把预算、成色、接口需求和使用场景整理成结构化请求，最终直连本地 API。"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">输入口径</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    预算支持区间或单边界，偏好项会一起带入 `/api/device-advisor`。
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">输出口径</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    结果会返回推荐列表、权衡点、适合人群和不适合人群。
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">数据来源</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    只用本地 Apple 样本数据库，不写入 `.env`，也不会暴露任何 API key。
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-soft)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">开发说明</div>
                  <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                    生产环境不暴露评测入口，顾问页只保留真实交互链路。
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {examplePrompts.map((item) => (
                <PromptCard key={item.title} title={item.title} body={item.body} />
              ))}
            </div>
          </div>

          <DeviceAdvisorPanel initialCategory="phone" />
        </div>
      </section>

      <TickDivider className="site-container" />
    </main>
  );
}
