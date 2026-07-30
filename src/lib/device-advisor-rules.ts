import {
  allDevices,
  categoryLabels,
  formatMaybeCurrency,
  specNum,
  specStr,
  type DbDevice,
} from "@/lib/devices-db";
import {
  CATEGORY_KEYWORDS,
  MAX_ALTERNATIVES,
  MAX_RECOMMENDATIONS,
  MAX_SHORTLIST,
  RULES_DEVICE_ADVISOR_DISCLAIMER,
  type Candidate,
  type DeviceAdvisorBudget,
  type DeviceAdvisorCategory,
  type DeviceAdvisorInput,
  type DeviceAdvisorOutput,
  type DeviceAdvisorRecommendation,
} from "@/lib/device-advisor-types";
import {
  normalizeBatteryPriority,
  normalizeBudget,
  normalizeConditionPreference,
  normalizeInterfaceNeed,
  normalizeUseCases,
  summarizeBudget,
} from "@/lib/device-advisor-normalize";
import { clamp, normalizeNumber, normalizeText } from "@/lib/device-advisor-utils";

function inferCategory(
  input: DeviceAdvisorInput,
  useCases: string[],
  intent: string,
): DeviceAdvisorCategory {
  if (input.category) return input.category;

  const text = [intent, ...useCases].join(" ").toLowerCase();
  for (const category of Object.keys(CATEGORY_KEYWORDS) as Array<
    Exclude<DeviceAdvisorCategory, "all">
  >) {
    if (CATEGORY_KEYWORDS[category].some((keyword) => text.includes(keyword))) {
      return category;
    }
  }
  return "all";
}

function getReferencePrice(device: DbDevice): number | null {
  return (
    specNum(device.specs.currentPrice) ??
    specNum(device.specs.usedPrice) ??
    specNum(device.specs.launchPrice) ??
    null
  );
}

function getPriceText(device: DbDevice): string {
  const currentPrice = specNum(device.specs.currentPrice);
  const usedPrice = specNum(device.specs.usedPrice);
  const launchPrice = specNum(device.specs.launchPrice);

  if (currentPrice !== undefined) return `当前价 ${formatMaybeCurrency(currentPrice)}`;
  if (usedPrice !== undefined) return `二手价 ${formatMaybeCurrency(usedPrice)}`;
  if (launchPrice !== undefined) return `首发价 ${formatMaybeCurrency(launchPrice)}`;
  return "价格待补充";
}

function compactText(value: string, maxLength = 160): string | undefined {
  if (!value) return undefined;
  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trimEnd()}…`;
}

function getFacts(device: DbDevice): Record<string, string | number> {
  const common: Record<string, string | number | undefined> = {
    chip: specStr(device.specs.chip, "") || undefined,
    screenSize: specNum(device.specs.screenSize),
    displayType: compactText(specStr(device.specs.displayType, "")),
    refreshRate: specNum(device.specs.refreshRate),
    weight: specNum(device.specs.weight),
    batteryLife: compactText(specStr(device.specs.batteryLife, "")),
    storage: specStr(device.specs.storage, "") || undefined,
    port: compactText(specStr(device.specs.port, "")),
  };
  const categoryFacts: Record<string, string | number | undefined> =
    device.category === "phone"
      ? {
          rearCamera: compactText(
            specStr(device.specs.mainCamera, "") ||
              specStr(device.specs.rearCamera, ""),
          ),
          frontCamera: compactText(specStr(device.specs.frontCamera, "")),
          chargingMethod: compactText(specStr(device.specs.chargingMethod, "")),
        }
      : device.category === "tablet"
        ? {
            memory: compactText(specStr(device.specs.memory, "")),
            rearCamera: compactText(specStr(device.specs.rearCamera, "")),
            frontCamera: compactText(specStr(device.specs.frontCamera, "")),
            pencilSupport: compactText(specStr(device.specs.pencilSupport, "")),
          }
        : {
            cpu: compactText(specStr(device.specs.cpu, "")),
            gpu: compactText(specStr(device.specs.gpu, "")),
            memory: compactText(specStr(device.specs.memory, "")),
            webcam: compactText(specStr(device.specs.webcam, "")),
            thunderbolt: compactText(specStr(device.specs.thunderbolt, "")),
          };
  const values = {
    ...common,
    ...categoryFacts,
  };

  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string | number] => {
      return entry[1] !== undefined;
    }),
  );
}

function normalizeCandidate(device: DbDevice): Candidate {
  return {
    deviceId: device.id,
    model: device.modelName,
    series: device.series,
    category: device.category,
    releaseYear: device.releaseYear,
    referencePrice: getReferencePrice(device),
    priceText: getPriceText(device),
    facts: getFacts(device),
  };
}

function isWithinBudget(price: number | null, budget: DeviceAdvisorBudget | null): boolean {
  if (price === null || !budget) return false;
  if (budget.min !== undefined && price < budget.min) return false;
  if (budget.max !== undefined && price > budget.max) return false;
  return true;
}

function budgetDistance(price: number | null, budget: DeviceAdvisorBudget | null): number {
  if (price === null) return Number.POSITIVE_INFINITY;
  if (!budget) return 0;
  if (budget.min !== undefined && price < budget.min) return budget.min - price;
  if (budget.max !== undefined && price > budget.max) return price - budget.max;
  return Math.abs(price - (budget.max ?? budget.min ?? price));
}

function sortCandidates(
  candidates: Candidate[],
  budget: DeviceAdvisorBudget | null,
): Candidate[] {
  return [...candidates].sort((left, right) => {
    if (budget) {
      const leftGroup =
        left.referencePrice === null ? 2 : isWithinBudget(left.referencePrice, budget) ? 0 : 1;
      const rightGroup =
        right.referencePrice === null ? 2 : isWithinBudget(right.referencePrice, budget) ? 0 : 1;
      if (leftGroup !== rightGroup) return leftGroup - rightGroup;

      const distance =
        budgetDistance(left.referencePrice, budget) -
        budgetDistance(right.referencePrice, budget);
      if (distance !== 0) return distance;
    } else {
      const priceAvailability =
        Number(left.referencePrice === null) - Number(right.referencePrice === null);
      if (priceAvailability !== 0) return priceAvailability;
    }

    if (right.releaseYear !== left.releaseYear) return right.releaseYear - left.releaseYear;
    return left.deviceId.localeCompare(right.deviceId, "en-US");
  });
}

export function buildDeviceAdvisorContext(input: DeviceAdvisorInput) {
  const useCases = normalizeUseCases(input.useCases);
  const intent = normalizeText(input.intent);
  const category = inferCategory(input, useCases, intent);
  const budget = normalizeBudget(input.budget) ?? null;
  const candidateShortlist = sortCandidates(
    allDevices
      .filter((device) => category === "all" || device.category === category)
      .map(normalizeCandidate),
    budget,
  ).slice(0, MAX_SHORTLIST);

  return {
    userProfile: {
      budget: budget
        ? {
            min: budget.min ?? null,
            max: budget.max ?? null,
            currency: budget.currency ?? "CNY",
            summary: summarizeBudget(budget),
          }
        : null,
      category,
      intent: intent || null,
      useCases,
      performancePreference: input.performancePreference ?? "balanced",
      conditionPreference:
        normalizeConditionPreference(input.conditionPreference) ?? "new_only",
      batteryPriority: normalizeBatteryPriority(input.batteryPriority) ?? "balanced",
      interfaceNeed: normalizeInterfaceNeed(input.interfaceNeed) ?? "any",
      replacementIntent: input.replacementIntent ?? "replace",
      maxResults: clamp(
        normalizeNumber(input.maxResults) ?? MAX_RECOMMENDATIONS,
        1,
        MAX_RECOMMENDATIONS,
      ),
    },
    candidateShortlist,
  };
}

function fallbackScore(candidate: Candidate, budget: DeviceAdvisorBudget | null): number {
  if (!budget) return 0.5;
  if (candidate.referencePrice === null) return 0.3;
  if (isWithinBudget(candidate.referencePrice, budget)) return 0.8;

  const anchor = Math.max(
    budget.max ?? budget.min ?? candidate.referencePrice,
    candidate.referencePrice,
    1,
  );
  return clamp(0.7 - budgetDistance(candidate.referencePrice, budget) / anchor, 0.2, 0.7);
}

function toFallbackRecommendation(
  candidate: Candidate,
  budget: DeviceAdvisorBudget | null,
  useCases: string[],
): DeviceAdvisorRecommendation {
  const reasons =
    candidate.referencePrice === null
      ? ["该机型属于当前设备类型候选，但价格信息尚不完整"]
      : budget && isWithinBudget(candidate.referencePrice, budget)
        ? [`${candidate.priceText} 在预算范围内`]
        : budget
          ? [`${candidate.priceText} 是当前候选中更接近预算的方案`]
          : [`${candidate.releaseYear} 年发布，按发布时间优先展示`];

  return {
    deviceId: candidate.deviceId,
    model: candidate.model,
    series: candidate.series,
    category: candidate.category,
    releaseYear: candidate.releaseYear,
    priceText: candidate.priceText,
    matchScore: Math.round(fallbackScore(candidate, budget) * 100) / 100,
    reasons,
    tradeoffs: ["当前为本地兜底排序，尚未进行模型需求分析"],
    suitableFor: useCases.length ? useCases.slice(0, 3) : ["快速查看预算附近机型"],
    notSuitableFor: ["需要精细比较性能、续航或影像取舍"],
  };
}

export function runFallbackDeviceAdvisor(input: DeviceAdvisorInput): DeviceAdvisorOutput {
  const context = buildDeviceAdvisorContext(input);
  const budget = normalizeBudget(input.budget) ?? null;
  const useCases = normalizeUseCases(input.useCases);
  const maxResults = context.userProfile.maxResults;
  const recommendations = context.candidateShortlist
    .slice(0, maxResults)
    .map((candidate) => toFallbackRecommendation(candidate, budget, useCases));
  const alternatives = context.candidateShortlist
    .slice(maxResults, maxResults + MAX_ALTERNATIVES)
    .map((candidate) => toFallbackRecommendation(candidate, budget, useCases));
  const categoryLabel =
    context.userProfile.category === "all"
      ? "全品类"
      : categoryLabels[context.userProfile.category];

  return {
    summary: `${categoryLabel}${budget ? ` · ${summarizeBudget(budget)}` : ""} 下，AI 暂不可用，以下结果按预算接近度和发布时间排序。`,
    recommendations,
    tradeoffs: ["本地兜底不分析性能、续航、影像等偏好，只保证候选和价格来自已收录数据"],
    suitableFor: useCases.length ? useCases.slice(0, 4) : ["快速查看候选设备"],
    notSuitableFor: ["需要完整场景分析和精细取舍"],
    alternatives,
    confidence: budget ? 0.45 : 0.35,
    source: "rules",
    disclaimer: RULES_DEVICE_ADVISOR_DISCLAIMER,
  };
}

export function groundDeviceAdvisorOutput(
  input: DeviceAdvisorInput,
  output: DeviceAdvisorOutput,
): DeviceAdvisorOutput | null {
  if (!output.recommendations.length && !output.alternatives.length) return output;

  const candidates = new Map(
    buildDeviceAdvisorContext(input).candidateShortlist.map((candidate) => [
      candidate.deviceId,
      candidate,
    ]),
  );
  const used = new Set<string>();
  const ground = (item: DeviceAdvisorRecommendation) => {
    const candidate = candidates.get(item.deviceId);
    if (!candidate || used.has(item.deviceId)) return null;
    used.add(item.deviceId);
    return {
      ...item,
      model: candidate.model,
      series: candidate.series,
      category: candidate.category,
      releaseYear: candidate.releaseYear,
      priceText: candidate.priceText,
    };
  };

  const recommendations = output.recommendations
    .map(ground)
    .filter((item): item is DeviceAdvisorRecommendation => item !== null);
  const alternatives = output.alternatives
    .map(ground)
    .filter((item): item is DeviceAdvisorRecommendation => item !== null);
  if (!recommendations.length || !alternatives.length) return null;

  return {
    ...output,
    recommendations,
    alternatives,
  };
}

export function buildDeviceAdvisorPrompt(input: DeviceAdvisorInput): string {
  return [
    "你是 DeviceScope 的 Apple 设备顾问。",
    "本地仅按设备类型、预算接近度和发布时间整理候选；你负责结合用户场景分析并排序。",
    "只能推荐 candidateShortlist 中的设备，不允许编造机型、价格或 facts 中没有的规格。",
    "每个事实性理由必须能在 candidateShortlist 对应设备的字段中找到依据；信息不足时明确说明。",
    "recommendations 按推荐优先级排列，第一项必须是主推荐；matchScore 为 0 到 1。",
    "只返回纯 JSON，对象字段必须且只能包含：summary、recommendations、tradeoffs、suitableFor、notSuitableFor、alternatives、confidence、source、disclaimer。",
    'source 固定为 "ai"，disclaimer 固定为 "基于已收录设备数据生成，仅供参考"。',
    "recommendations 和 alternatives 每项必须包含 deviceId、model、series、category、releaseYear、priceText、matchScore、reasons、tradeoffs、suitableFor、notSuitableFor。",
    "只有在用户提供预算上限、所有候选价格都明确且都超过预算时，才允许 recommendations 和 alternatives 同时为空。",
    "",
    "输入数据：",
    JSON.stringify(buildDeviceAdvisorContext(input)),
    "",
    "请直接返回 JSON。",
  ].join("\n");
}
