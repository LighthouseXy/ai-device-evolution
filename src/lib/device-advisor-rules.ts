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
  DEFAULT_DEVICE_ADVISOR_DISCLAIMER,
  MAX_RECOMMENDATIONS,
  MAX_SHORTLIST,
  RULES_DEVICE_ADVISOR_DISCLAIMER,
  type Candidate,
  type DeviceAdvisorBudget,
  type DeviceAdvisorCategory,
  type DeviceAdvisorDevice,
  type DeviceAdvisorInput,
  type DeviceAdvisorModelOutput,
  type DeviceAdvisorOutput,
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

function toAdvisorDevice(candidate: Candidate): DeviceAdvisorDevice {
  return {
    deviceId: candidate.deviceId,
    model: candidate.model,
    series: candidate.series,
    category: candidate.category,
    releaseYear: candidate.releaseYear,
    priceText: candidate.priceText,
  };
}

export function runFallbackDeviceAdvisor(input: DeviceAdvisorInput): DeviceAdvisorOutput {
  const context = buildDeviceAdvisorContext(input);
  const budget = normalizeBudget(input.budget) ?? null;
  const maxResults = context.userProfile.maxResults;
  const devices = context.candidateShortlist
    .slice(0, maxResults)
    .map(toAdvisorDevice);
  const categoryLabel =
    context.userProfile.category === "all"
      ? "全品类"
      : categoryLabels[context.userProfile.category];
  const deviceNames = devices.map((device) => device.model).join("、");
  const candidateText = deviceNames
    ? `先列出：${deviceNames}。`
    : "暂时没有可展示的候选设备。";

  return {
    answer: `AI 暂不可用。${categoryLabel}${budget ? `、预算 ${summarizeBudget(budget)}` : ""} 条件下，按预算接近度和发布时间${candidateText}这只是本地排序，不分析性能、续航、影像等使用偏好。`,
    devices,
    confidence: budget ? 0.45 : 0.35,
    source: "rules",
    disclaimer: RULES_DEVICE_ADVISOR_DISCLAIMER,
  };
}

export function groundDeviceAdvisorOutput(
  input: DeviceAdvisorInput,
  output: DeviceAdvisorModelOutput,
): DeviceAdvisorOutput | null {
  const context = buildDeviceAdvisorContext(input);
  const candidates = new Map(
    context.candidateShortlist.map((candidate) => [
      candidate.deviceId,
      candidate,
    ]),
  );
  if (output.recommendedDeviceIds.some((deviceId) => !candidates.has(deviceId))) {
    return null;
  }
  const used = new Set<string>();
  const devices = output.recommendedDeviceIds
    .map((deviceId) => {
      const candidate = candidates.get(deviceId);
      if (!candidate || used.has(deviceId)) return null;
      used.add(deviceId);
      return toAdvisorDevice(candidate);
    })
    .filter((device): device is DeviceAdvisorDevice => device !== null)
    .slice(0, context.userProfile.maxResults);
  if (output.recommendedDeviceIds.length && !devices.length) return null;

  return {
    answer: output.answer,
    devices,
    confidence: output.confidence,
    source: "ai",
    disclaimer: DEFAULT_DEVICE_ADVISOR_DISCLAIMER,
  };
}

export function buildDeviceAdvisorPrompt(input: DeviceAdvisorInput): string {
  return [
    "你是 DeviceScope 的 Apple 设备顾问。",
    "本地仅按设备类型、预算接近度和发布时间整理候选；你负责结合用户场景给出自然、完整的中文购买建议。",
    "只能推荐 candidateShortlist 中的设备，不允许编造机型、价格或 facts 中没有的规格。",
    "answer 用 150 到 300 个汉字说明推荐哪几款、为什么以及主要取舍，不使用 Markdown、列表或虚构的精确评分。",
    "referencePrice 只是 priceText 标明的当前价、二手价或首发价；不得把首发价描述成当前市场价。",
    "recommendedDeviceIds 按推荐顺序给出 1 到 3 个 deviceId，并且与 answer 中提到的设备保持一致；确实没有合适设备时可返回空数组并在 answer 中解释。",
    "confidence 为 0 到 1，只供系统内部评测。",
    "只返回纯 JSON，对象字段必须且只能包含 answer、recommendedDeviceIds、confidence。",
    "",
    "输入数据：",
    JSON.stringify(buildDeviceAdvisorContext(input)),
    "",
    "请直接返回 JSON，例如：{\"answer\":\"...\",\"recommendedDeviceIds\":[\"device-id\"],\"confidence\":0.8}",
  ].join("\n");
}
