import DeviceAdvisorPanel from "@/components/DeviceAdvisorPanel";
import PageHeader from "@/components/layout/PageHeader";
import TickDivider from "@/components/layout/TickDivider";

export default function AdvisorPage() {
  return (
    <main className="site-main">
      <PageHeader
        eyebrow="智能推荐"
        title="AI 顾问"
        meta={
          <>
            <span className="tag tag-green">真实表单</span>
            <span className="tag tag-neutral">多品牌样本</span>
            <span className="tag tag-amber">API 直连</span>
          </>
        }
      />

      <section className="section pt-0">
        <div className="section-inner mx-auto min-w-0 max-w-5xl">
          <DeviceAdvisorPanel initialCategory="phone" />
        </div>
      </section>

      <TickDivider className="site-container" />
    </main>
  );
}
