"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  DeviceAdvisorEvalBundle,
  DeviceAdvisorEvalFileResult,
} from "@/lib/device-advisor-eval";
import {
  entriesByCount,
  EvalFileBadge,
  formatCounts,
  formatMs,
  formatNumber,
  formatPercent,
  RunCard,
  SectionTitle,
  SummaryStat,
} from "@/components/DeviceAdvisorEvalParts";

type LoadState = {
  loading: boolean;
  error: string;
  data: DeviceAdvisorEvalBundle | null;
};

export default function DeviceAdvisorEvalDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({
    loading: true,
    error: "",
    data: null,
  });
  const selectedFile = searchParams.get("file") ?? "";

  useEffect(() => {
    const controller = new AbortController();

    async function loadEval() {
      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const params = new URLSearchParams();
        if (selectedFile) {
          params.set("file", selectedFile);
        }

        const response = await fetch(`/api/dev/device-advisor-eval${params.toString() ? `?${params.toString()}` : ""}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `请求失败 (${response.status})`);
        }

        const data = (await response.json()) as DeviceAdvisorEvalBundle;
        setState({ loading: false, error: "", data });
        if (data.selectedFile && data.selectedFile.name !== selectedFile) {
          const paramsWithSelection = new URLSearchParams(searchParams.toString());
          paramsWithSelection.set("file", data.selectedFile.name);
          router.replace(`${pathname}?${paramsWithSelection.toString()}`);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "加载评测结果失败",
          data: null,
        });
      }
    }

    loadEval();

    return () => controller.abort();
  }, [pathname, router, searchParams, selectedFile]);

  const data = state.data;
  const result: DeviceAdvisorEvalFileResult | null = data?.result ?? null;
  const activeResult = result && result.summary ? result : null;
  const files = data?.files ?? [];
  const summary = activeResult?.summary ?? null;
  const byGroup = activeResult?.byGroup ?? {};
  const bySample = activeResult?.bySample ?? {};
  const runs = activeResult?.runs ?? [];

  const summaryCards = summary
    ? [
        { label: "总调用", value: formatNumber(summary.total), hint: "样本请求总数" },
        { label: "AI / 规则 / 错误", value: formatCounts(summary.source), hint: "最终输出来源分布" },
        { label: "平均置信度", value: formatPercent(summary.averageConfidence), hint: "0 到 1 的均值" },
        { label: "平均延迟", value: formatMs(summary.averageLatencyMs), hint: "单次总耗时" },
        { label: "P50 / P95", value: `${formatMs(summary.latencyP50Ms)} / ${formatMs(summary.latencyP95Ms)}`, hint: "延迟分位数" },
        { label: "Retry / Rate", value: `${formatNumber(summary.retryUsed)} / ${formatPercent(summary.retryRate)}`, hint: "重试计数与比例" },
      ]
    : [];

  const isEmpty = !result || summary === null || runs.length === 0;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F6F3EA_0%,#EEF6FF_100%)] px-4 py-6 text-[var(--text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs uppercase tracking-[0.28em] text-[var(--text-muted)]">Dev only</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                device-advisor AI eval 看板
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                从 `.eval-results/*.json` 读取最新结果，支持按文件切换，展示 KPI、retryReasons、missingFieldsTopN、group 聚合以及 sample / run 明细。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]">
                NODE_ENV !== production
              </span>
              <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--text-secondary)]">
                只读 API
              </span>
              <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-[var(--text-secondary)]">
                不读取 .env
              </span>
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 shadow-sm">
          <SectionTitle
            eyebrow="文件选择"
            title="评测结果切换"
            description="默认显示最新结果；可通过文件名切换到其他 `.json` 结果文件。"
          />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[var(--text)]">结果文件</span>
              <select
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--primary)]"
                value={selectedFile}
                onChange={(event) => {
                  const nextFile = event.target.value;
                  const params = new URLSearchParams(searchParams.toString());
                  if (nextFile) {
                    params.set("file", nextFile);
                  } else {
                    params.delete("file");
                  }
                  const query = params.toString();
                  router.replace(query ? `${pathname}?${query}` : pathname);
                }}
              >
                <option value="">最新结果</option>
                {files.map((file) => (
                  <option key={file.name} value={file.name}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col justify-end gap-3">
              {data?.selectedFile ? <EvalFileBadge file={data.selectedFile} /> : null}
              <div className="text-sm text-[var(--text-secondary)]">
                {data?.warning ?? (state.loading ? "加载中..." : data?.selectedFile ? "结果已加载" : "暂无结果文件")}
              </div>
            </div>
          </div>
        </section>

        {state.error ? (
          <section className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-700">
            <h2 className="text-lg font-semibold">加载失败</h2>
            <p className="mt-2 text-sm">{state.error}</p>
          </section>
        ) : null}

        {state.loading ? (
          <section className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 text-sm text-[var(--text-secondary)]">
            正在加载评测结果...
          </section>
        ) : null}

        {isEmpty && !state.loading && !state.error ? (
          <section className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6">
            <h2 className="text-lg font-semibold">暂无评测结果</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              在 `.eval-results/` 下放入一个或多个 `.json` 结果文件后，这里会自动读取最新文件并允许切换。
            </p>
          </section>
        ) : null}

        {activeResult && summary ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <SummaryStat key={card.label} label={card.label} value={card.value} hint={card.hint} />
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 shadow-sm">
                <SectionTitle
                  eyebrow="质量指标"
                  title="Retry 与缺失字段"
                  description="帮助判断 AI 输出是否稳定，以及哪些字段最常缺失。"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-start)]/40 p-4">
                    <div className="text-sm font-medium">retryReasons</div>
                    <div className="mt-3 space-y-2">
                      {entriesByCount(summary.retryReasons).length > 0 ? (
                        entriesByCount(summary.retryReasons).map(([reason, count]) => (
                          <div key={reason} className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate text-[var(--text-secondary)]">{reason}</span>
                            <span className="rounded-full bg-white px-3 py-1 font-medium">{count}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--text-muted)]">无</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-end)]/50 p-4">
                    <div className="text-sm font-medium">missingFieldsTopN</div>
                    <div className="mt-3 space-y-2">
                      {entriesByCount(summary.missingFieldsTopN).length > 0 ? (
                        entriesByCount(summary.missingFieldsTopN).map(([field, count]) => (
                          <div key={field} className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate text-[var(--text-secondary)]">{field}</span>
                            <span className="rounded-full bg-white px-3 py-1 font-medium">{count}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--text-muted)]">无</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 shadow-sm">
                <SectionTitle
                  eyebrow="文件信息"
                  title="Metadata"
                  description="展示当前文件的来源与生成信息。"
                />
                <dl className="grid gap-4 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-dashed border-[var(--border)] pb-3">
                    <dt className="text-[var(--text-secondary)]">Provider</dt>
                    <dd className="font-medium">{activeResult.metadata.provider ?? "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-dashed border-[var(--border)] pb-3">
                    <dt className="text-[var(--text-secondary)]">Generated at</dt>
                    <dd className="font-medium">{activeResult.metadata.generatedAt ? new Date(activeResult.metadata.generatedAt).toLocaleString("zh-CN") : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-dashed border-[var(--border)] pb-3">
                    <dt className="text-[var(--text-secondary)]">Sample count</dt>
                    <dd className="font-medium">{formatNumber(activeResult.metadata.sampleCount ?? null)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-dashed border-[var(--border)] pb-3">
                    <dt className="text-[var(--text-secondary)]">Total calls</dt>
                    <dd className="font-medium">{formatNumber(activeResult.metadata.totalCalls ?? null)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--text-secondary)]">Runs</dt>
                    <dd className="font-medium">{formatNumber(activeResult.metadata.runs ?? null)}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 shadow-sm">
              <SectionTitle
                eyebrow="Group 聚合"
                title="按 group 汇总"
                description="显示每个 group 的总体 KPI，便于比较不同样本簇。"
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(byGroup).map(([group, groupSummary]) => (
                  <div key={group} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-start)]/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{group}</div>
                      <div className="text-xs text-[var(--text-muted)]">{formatNumber(groupSummary.total)} cases</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white px-3 py-2 text-sm">
                        <div className="text-[var(--text-muted)]">Source</div>
                        <div className="font-medium">{formatCounts(groupSummary.source)}</div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-sm">
                        <div className="text-[var(--text-muted)]">Avg confidence</div>
                        <div className="font-medium">{formatPercent(groupSummary.averageConfidence)}</div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-sm">
                        <div className="text-[var(--text-muted)]">Avg latency</div>
                        <div className="font-medium">{formatMs(groupSummary.averageLatencyMs)}</div>
                      </div>
                      <div className="rounded-xl bg-white px-3 py-2 text-sm">
                        <div className="text-[var(--text-muted)]">Retry rate</div>
                        <div className="font-medium">{formatPercent(groupSummary.retryRate)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 shadow-sm">
              <SectionTitle
                eyebrow="Sample 明细"
                title="按 sample 汇总"
                description="查看每个 sample 的平均表现、重试和缺失字段。"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead className="text-left text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Sample</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Source</th>
                      <th className="px-3 py-2 font-medium">Confidence</th>
                      <th className="px-3 py-2 font-medium">Latency</th>
                      <th className="px-3 py-2 font-medium">Retry</th>
                      <th className="px-3 py-2 font-medium">Retry reasons</th>
                      <th className="px-3 py-2 font-medium">Missing fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(bySample).map(([sampleId, sampleSummary]) => (
                      <tr key={sampleId} className="rounded-2xl bg-[var(--bg-start)]/30">
                        <td className="px-3 py-3 font-medium">{sampleId}</td>
                        <td className="px-3 py-3">{formatNumber(sampleSummary.total)}</td>
                        <td className="px-3 py-3">{formatCounts(sampleSummary.source)}</td>
                        <td className="px-3 py-3">{formatPercent(sampleSummary.averageConfidence)}</td>
                        <td className="px-3 py-3">{formatMs(sampleSummary.averageLatencyMs)}</td>
                        <td className="px-3 py-3">{formatPercent(sampleSummary.retryRate)}</td>
                        <td className="px-3 py-3">{entriesByCount(sampleSummary.retryReasons).map(([reason, count]) => `${reason} (${count})`).join("；") || "—"}</td>
                        <td className="px-3 py-3">{entriesByCount(sampleSummary.missingFieldsTopN).map(([field, count]) => `${field} (${count})`).join("；") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--border)] bg-white/80 p-6 shadow-sm">
              <SectionTitle
                eyebrow="Run 明细"
                title="逐次运行记录"
                description="按 run 级别展示原始执行结果，适合排查 retry 和异常样本。"
              />
              <div className="space-y-4">
                {runs.map((run) => (
                  <RunCard key={`${run.id}-${run.run}`} run={run} />
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
