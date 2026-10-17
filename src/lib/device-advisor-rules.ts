import {
  allDevices,
  categoryLabels,
  formatMaybeCurrency,
  flattenDevice,
  specNum,
  specStr,
  type DbDevice,
  type PriceField,
} from "@/lib/devices-db";
import { getPriceConfiguration, getValidPriceFields } from "@/lib/device-configurations";
import { getDeviceModelId } from "@/lib/device-models";
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

type SelectedPrice = { field: PriceField & { value: number }; type: "current" | "used" };

function selectPrices(
  device: DbDevice,
  conditionPreference: DeviceAdvisorInput["conditionPreference"],
  budget: DeviceAdvisorBudget | null,
  requirements: { minMemoryGb: number; minStorageGb: number },
): SelectedPrice[] {
  const flat = flattenDevice(device);
  const types = conditionPreference === "used_ok" ? ["current", "used"] as const : ["current"] as const;
  return types.flatMap((type) => getValidPriceFields(flat, type).map((field) => ({ field, type })))
    .filter(({ field }) => {
      const configuration = getPriceConfiguration(flat, field);
      return configuration && capacityGb(configuration.memory) >= requirements.minMemoryGb
        && capacityGb(configuration.storage) >= requirements.minStorageGb;
    })
    .sort((a, b) => {
      if (budget) {
        const within = Number(isWithinBudget(b.field.value, budget)) - Number(isWithinBudget(a.field.value, budget));
        if (within) return within;
        const distance = budgetDistance(a.field.value, budget) - budgetDistance(b.field.value, budget);
        if (distance) return distance;
      }
      return a.field.value - b.field.value || (b.field.observedAt ?? "").localeCompare(a.field.observedAt ?? "");
    });
}

function capacityGb(value: string | null | undefined): number {
  const match = value?.match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
  return match ? Number(match[1]) * (match[2].toUpperCase() === "TB" ? 1024 : 1) : 0;
}

function minimumRequirements(input: DeviceAdvisorInput) {
  const result = { minMemoryGb: input.minMemoryGb ?? 0, minStorageGb: input.minStorageGb ?? 0 };
  // Standalone capacity clauses set minimums; negated or ambiguous prose stays with the model.
  const text = [input.intent, ...normalizeUseCases(input.useCases)].filter(Boolean).join("，");
  for (const match of text.matchAll(/(?:^|[，,、。；;\n])\s*(?:(?:至少|最低|不低于)\s*)?(\d+(?:\.\d+)?)\s*(GB|TB|G|T)\s*(?:的)?\s*(运行内存|内存|存储|硬盘)(?=$|[，,、。；;\n])/gi)) {
    const key = /内存/.test(match[3]) ? "minMemoryGb" : "minStorageGb";
    result[key] = Math.max(result[key], Number(match[1]) * (/^T/i.test(match[2]) ? 1024 : 1));
  }
  return result;
}

function matchesInterfaceNeed(
  device: DbDevice,
  interfaceNeed: NonNullable<DeviceAdvisorInput["interfaceNeed"]>,
): boolean {
  if (interfaceNeed === "any") return true;
  if (interfaceNeed === "magsafe") return device.specs.hasMagSafe?.value === true;
  if (interfaceNeed === "pencil") return Boolean(specStr(device.specs.pencilSupport, ""));

  const ports = [
    specStr(device.specs.port, ""),
    specStr(device.specs.usbC, ""),
    specStr(device.specs.thunderbolt, ""),
  ].join(" ");
  return /usb[ -]?(?:c|type[ -]?c)|type[ -]?c|雷雳|thunderbolt/i.test(ports);
}

function getPriceText(
  device: DbDevice,
  conditionPreference: DeviceAdvisorInput["conditionPreference"],
  selected: SelectedPrice | undefined,
): string {
  const launchPrice = specNum(device.specs.launchPrice);
  if (selected) {
    const { field, type } = selected;
    const snapshot = [field.sourceName, field.observedAt].filter(Boolean).join("，");
    const availabilityNote = /暂时缺货|无货|售罄/.test(field.condition ?? "") ? "（缺货标价，仅供参考）" : "";
    return `${type === "used" ? "二手价" : "当前价"} ${formatMaybeCurrency(field.value)}${snapshot ? `（${snapshot}）` : ""}${availabilityNote} · ${field.configuration}`;
  }
  const missingLabel = conditionPreference === "used_ok" ? "当前价与二手价待补充" : "当前价待补充";
  return launchPrice === undefined
    ? missingLabel
    : `${missingLabel}（首发价 ${formatMaybeCurrency(launchPrice)}，不用于预算筛选）`;
}

function compactText(value: string, maxLength = 160): string | undefined {
  if (!value) return undefined;
  return value.length <= maxLength ? value : `${value.slice(0, maxLength).trimEnd()}…`;
}

function getFacts(device: DbDevice): Record<string, string | number> {
  const cameraBenchmark = device.benchmarks?.find(
    (benchmark) => benchmark.provider === "DXOMARK" && benchmark.metric === "camera",
  );
  const common: Record<string, string | number | undefined> = {
    evidenceNote: Object.values(device.specs).some((field) => field?.evidenceKind === "summary")
      ? "部分规格为历史整理值，原文证据待补；不代表本次重新核验" : undefined,
    chip: specStr(device.specs.chip, "") || specStr(device.specs.wearableChip, "") || undefined,
    chipNote: device.specs.chip?.note,
    screenSize: specNum(device.specs.screenSize),
    displayType: compactText(specStr(device.specs.displayType, "")),
    refreshRate: specNum(device.specs.refreshRate),
    refreshRateNote: device.specs.refreshRate?.note,
    weight: specNum(device.specs.weight),
    weightNote: device.specs.weight?.note,
    batteryLife: compactText(specStr(device.specs.batteryLife, "")),
    batteryCapacityMah: specNum(device.specs.batteryCapacity),
    memory: compactText(specStr(device.specs.memory, "")),
    storage: specStr(device.specs.storage, "") || undefined,
    configurations: device.configurations
      ?.map((configuration) => `${configuration.memory}+${configuration.storage}${configuration.chip ? `（${configuration.chip}）` : ""}`)
      .join(" / "),
    port: compactText(specStr(device.specs.port, "")),
  };
  const categoryFacts: Record<string, string | number | undefined> =
    device.category === "phone"
      ? {
          rearCamera: compactText(
            specStr(device.specs.rearCamera, "") ||
              specStr(device.specs.mainCamera, ""),
          ),
          rearCameraNote: device.specs.rearCamera?.note,
          mainCamera: compactText(specStr(device.specs.mainCamera, "")),
          telephoto: compactText(specStr(device.specs.telephoto, "")),
          frontCamera: compactText(specStr(device.specs.frontCamera, "")),
          frontCameraNote: device.specs.frontCamera?.note,
          chargingMethod: compactText(specStr(device.specs.chargingMethod, "")),
          dxomarkCamera: cameraBenchmark
            ? `${cameraBenchmark.score} 分（${cameraBenchmark.protocolVersion}）`
            : undefined,
          dxomarkNote: cameraBenchmark?.notes,
        }
      : device.category === "tablet"
        ? {
            memory: compactText(specStr(device.specs.memory, "")),
            rearCamera: compactText(specStr(device.specs.rearCamera, "")),
            frontCamera: compactText(specStr(device.specs.frontCamera, "")),
            pencilSupport: compactText(specStr(device.specs.pencilSupport, "")),
          }
        : device.category === "laptop" ? {
            cpu: compactText(specStr(device.specs.cpu, "")),
            gpu: compactText(specStr(device.specs.gpu, "")),
            memory: compactText(specStr(device.specs.memory, "")),
            webcam: compactText(specStr(device.specs.webcam, "")),
            thunderbolt: compactText(specStr(device.specs.thunderbolt, "")),
          } : {
            compatibility: compactText(specStr(device.specs.compatibility, "")),
            positioning: compactText(specStr(device.specs.positioning, "")),
            sensors: compactText(specStr(device.specs.sensors, "")),
            healthFeatures: compactText(specStr(device.specs.healthFeatures, "")),
            wearableFeatures: compactText(specStr(device.specs.wearableFeatures, "")),
            sportsModes: compactText(specStr(device.specs.sportsModes, "")),
            waterResistance: compactText(specStr(device.specs.waterResistance, "")),
            cellular: compactText(specStr(device.specs.cellular, "")),
            wearableNote: "健康监测不等于医疗诊断；功能和续航受手机系统、地区及使用模式限制",
          };
  const values = {
    ...common,
    ...categoryFacts,
  };

  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string | number] => {
      return entry[1] !== undefined && entry[1] !== "";
    }),
  );
}

function normalizeCandidate(
  device: DbDevice,
  conditionPreference: DeviceAdvisorInput["conditionPreference"],
  budget: DeviceAdvisorBudget | null,
  requirements: ReturnType<typeof minimumRequirements>,
): Candidate {
  const prices = selectPrices(device, conditionPreference, budget, requirements);
  const primary = prices[0];
  const alternatives = prices.slice(1).filter((quote) => !budget || !isWithinBudget(primary?.field.value ?? null, budget)
    || isWithinBudget(quote.field.value, budget));
  // ponytail: at most two offers per model; prefer new/used comparison before another configuration.
  const alternative = alternatives.find((quote) => quote.type !== primary?.type)
    ?? alternatives.find((quote) => quote.field.configuration !== primary?.field.configuration);
  const quotes = (alternative ? [primary, alternative] : [primary]).map((selected, index) => {
    const configuration = selected ? getPriceConfiguration(flattenDevice(device), selected.field) : null;
    const facts = getFacts(device);
    if (selected && configuration) {
      if (device.category !== "watch" && device.category !== "band") {
        facts.memory = configuration.memory ?? "待补充";
        facts.storage = configuration.storage;
      }
      if (configuration.chip) facts.chip = configuration.chip;
      facts.priceConfiguration = selected.field.configuration!;
      facts.priceCondition = selected.field.condition ?? "待补充";
      delete facts.configurations;
      // CPU/GPU 字段可能是该机型的多个可选档位，不代表此报价包含最高档。
      for (const [key, cores] of [["cpu", configuration.cpuCores], ["gpu", configuration.gpuCores]] as const) {
        if (cores !== undefined) facts[key] = `${cores} 核`;
        else if (facts[key]) facts[key] = `机型可选规格，报价档位以 priceConfiguration 为准：${facts[key]}`;
      }
    }
    return {
      quoteId: `${device.id}:q${index}`,
      priceType: selected?.type ?? null,
      sourceName: selected?.field.sourceName,
      observedAt: selected?.field.observedAt,
      referencePrice: selected?.field.value ?? null,
      priceText: getPriceText(device, conditionPreference, selected),
      facts,
    };
  });
  return {
    deviceId: device.id,
    brand: device.brand,
    model: device.modelName,
    series: device.series,
    category: device.category,
    releaseYear: device.releaseYear,
    referencePrice: quotes[0].referencePrice,
    priceText: quotes[0].priceText,
    facts: quotes[0].facts,
    quotes,
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
  return 0;
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

      if (leftGroup !== 2) {
        const distance =
          budgetDistance(left.referencePrice, budget) -
          budgetDistance(right.referencePrice, budget);
        if (distance !== 0) return distance;
      }
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
  const conditionPreference =
    normalizeConditionPreference(input.conditionPreference) ?? "new_only";
  const interfaceNeed = normalizeInterfaceNeed(input.interfaceNeed) ?? "any";
  const requirements = minimumRequirements(input);
  const candidates = allDevices
    .filter(
      (device) =>
        (category === "all" || device.category === category) &&
        matchesInterfaceNeed(device, interfaceNeed),
    )
    .map((device) => normalizeCandidate(device, conditionPreference, budget, requirements))
    .filter((candidate) => (!requirements.minMemoryGb && !requirements.minStorageGb) || candidate.referencePrice !== null);
  const budgetMatches = budget
    ? candidates.filter((candidate) => isWithinBudget(candidate.referencePrice, budget))
    : [];
  const seenModels = new Set<string>();
  const sorted = sortCandidates(
    budgetMatches.length ? budgetMatches : candidates,
    budget,
  ).filter(candidate => {
    const id = getDeviceModelId(candidate.deviceId);
    if (seenModels.has(id)) return false;
    seenModels.add(id); return true;
  });
  const selected = new Set(sorted.slice(0, MAX_RECOMMENDATIONS));
  // ponytail: bounded coverage, not a quality score; revisit only if evaluations show missed choices.
  if (sorted.length > MAX_SHORTLIST && (!budget || budgetMatches.length)) {
    const priced = sorted.filter((candidate) => candidate.referencePrice !== null)
      .sort((a, b) => a.referencePrice! - b.referencePrice!);
    const add = (candidate: Candidate | undefined) => {
      if (candidate && selected.size < MAX_SHORTLIST) selected.add(candidate);
    };
    // Keep real price endpoints; picking the newest in the lowest quantile can still miss cheap options.
    add(priced[0]);
    add(priced.at(-1));
    const middle = new Set(priced.slice(Math.floor(priced.length / 3), Math.floor(priced.length * 2 / 3)));
    add(sorted.find((candidate) => middle.has(candidate)));
    const brands = new Set([...selected].map((candidate) => candidate.brand));
    for (const candidate of sorted) {
      if (!brands.has(candidate.brand) && candidate.referencePrice !== null) {
        add(candidate);
        brands.add(candidate.brand);
      }
    }
  }
  for (const candidate of sorted) {
    if (selected.size >= MAX_SHORTLIST) break;
    selected.add(candidate);
  }
  const candidateShortlist = sorted.filter((candidate) => selected.has(candidate));

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
      conditionPreference,
      batteryPriority: normalizeBatteryPriority(input.batteryPriority) ?? "balanced",
      interfaceNeed,
      ...requirements,
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

function toAdvisorDevice(candidate: Candidate, quote = candidate.quotes[0]): DeviceAdvisorDevice {
  return {
    quoteId: quote.quoteId,
    deviceId: candidate.deviceId,
    model: candidate.model,
    series: candidate.series,
    category: candidate.category,
    releaseYear: candidate.releaseYear,
    priceText: quote.priceText,
  };
}

export function runFallbackDeviceAdvisor(input: DeviceAdvisorInput): DeviceAdvisorOutput {
  const context = buildDeviceAdvisorContext(input);
  const budget = normalizeBudget(input.budget) ?? null;
  const maxResults = context.userProfile.maxResults;
  const devices = context.candidateShortlist
    .slice(0, maxResults)
    .map((candidate) => toAdvisorDevice(candidate));
  const categoryLabel =
    context.userProfile.category === "all"
      ? "全品类"
      : categoryLabels[context.userProfile.category];
  const deviceNames = devices.map((device) => device.model).join("、");
  const candidateText = deviceNames
    ? `先列出：${deviceNames}。`
    : "暂时没有可展示的候选设备。";
  const requirementsText = [
    context.userProfile.minMemoryGb ? `内存至少 ${context.userProfile.minMemoryGb}GB` : "",
    context.userProfile.minStorageGb ? `存储至少 ${context.userProfile.minStorageGb}GB` : "",
  ].filter(Boolean).join("、");

  const hasReferencePrice = context.candidateShortlist.some(
    (candidate) => candidate.referencePrice !== null,
  );
  const sortingText = budget && hasReferencePrice
    ? "按对应成色的预算接近度和发布时间"
    : budget
      ? "对应成色价格尚未收录，暂按发布时间"
      : "按发布时间";
  const budgetNotice = budget && devices.length && !context.candidateShortlist.some((candidate) => isWithinBudget(candidate.referencePrice, budget))
    ? "没有已收录的预算内报价，以下仅为预算外或价格未知的备选。" : "";

  return {
    answer: `AI 暂不可用。${budgetNotice}${categoryLabel}${budget ? `、预算 ${summarizeBudget(budget)}` : ""}${requirementsText ? `、${requirementsText}（仅采用有对应配置报价的设备）` : ""} 条件下，${context.userProfile.interfaceNeed === "any" ? "" : "先按接口兼容性筛选，再"}${sortingText}${candidateText}这只是本地排序，不分析性能、续航、影像等使用偏好。`,
    devices,
    confidence: budget ? 0.45 : 0.35,
    source: "rules",
    disclaimer: RULES_DEVICE_ADVISOR_DISCLAIMER,
  };
}

export function groundDeviceAdvisorOutput(
  input: DeviceAdvisorInput,
  output: DeviceAdvisorModelOutput,
  onReject?: (reason: string) => void,
): DeviceAdvisorOutput | null {
  const reject = (reason: string) => { onReject?.(reason); return null; };
  const context = buildDeviceAdvisorContext(input);
  const candidates = new Map(
    context.candidateShortlist.map((candidate) => [
      candidate.deviceId,
      candidate,
    ]),
  );
  if (new Set(output.recommendedDeviceIds).size > context.userProfile.maxResults
    || output.recommendedQuoteIds?.length !== output.recommendedDeviceIds.length
    || output.recommendedDeviceIds.some((deviceId, index) => output.recommendedQuoteIds[index] !== output.recommendedQuoteIds[output.recommendedDeviceIds.indexOf(deviceId)])
    || output.recommendedDeviceIds.some((deviceId, index) => !candidates.get(deviceId)?.quotes.some((quote) => quote.quoteId === output.recommendedQuoteIds[index]))) {
    return reject("invalid_selection: device count, quote ownership or repeated selection conflict");
  }
  const selectedPrices = new Set(output.recommendedDeviceIds.map((id, index) =>
    candidates.get(id)!.quotes.find((quote) => quote.quoteId === output.recommendedQuoteIds[index])!.referencePrice));
  const otherPrices = new Set(context.candidateShortlist.flatMap((candidate) => candidate.quotes)
    .map((quote) => quote.referencePrice).filter((price) => price !== null && !selectedPrices.has(price)));
  const budget = context.userProfile.budget;
  // Explicit yuan amounts only; this is not a general natural-language fact checker.
  for (const match of output.answer.matchAll(/[¥￥]\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*元/g)) {
    const amount = Number((match[1] ?? match[2]).replaceAll(",", ""));
    if (otherPrices.has(amount) && amount !== budget?.min && amount !== budget?.max) return reject(`unselected_price: ${amount}`);
  }
  // Longest model names first: iPhone 17 Pro Max must not also count as iPhone 17.
  const compact = (text: string) => text.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  let remainingAnswer = compact(output.answer);
  for (const candidate of [...candidates.values()].sort((a, b) => compact(b.model).length - compact(a.model).length)) {
    const name = compact(candidate.model);
    if (!remainingAnswer.includes(name)) continue;
    if (!output.recommendedDeviceIds.includes(candidate.deviceId)) return reject(`unselected_model: ${candidate.model}`);
    remainingAnswer = remainingAnswer.replaceAll(name, "");
  }
  const used = new Set<string>();
  const devices = output.recommendedDeviceIds
    .map((deviceId, index) => {
      const candidate = candidates.get(deviceId);
      if (!candidate || used.has(deviceId)) return null;
      used.add(deviceId);
      return toAdvisorDevice(candidate, candidate.quotes.find((quote) => quote.quoteId === output.recommendedQuoteIds[index])!);
    })
    .filter((device): device is DeviceAdvisorDevice => device !== null);
  if (output.recommendedDeviceIds.length && !devices.length) return null;

  return {
    answer: output.answer,
    devices,
    confidence: output.confidence,
    source: "ai",
    disclaimer: DEFAULT_DEVICE_ADVISOR_DISCLAIMER,
  };
}

export function buildDeviceAdvisorPrompt(
  input: DeviceAdvisorInput,
  selection?: Pick<DeviceAdvisorModelOutput, "recommendedDeviceIds" | "recommendedQuoteIds">,
): string {
  const context = buildDeviceAdvisorContext(input);
  if (selection) {
    context.candidateShortlist = context.candidateShortlist.flatMap((candidate) => {
      const index = selection.recommendedDeviceIds.indexOf(candidate.deviceId);
      if (index < 0) return [];
      const quotes = candidate.quotes.filter((quote) => quote.quoteId === selection.recommendedQuoteIds[index]);
      return quotes.length ? [{ ...candidate, quotes }] : [];
    });
  }
  const request = [context.userProfile.intent, ...context.userProfile.useCases, context.userProfile.performancePreference].join(" ");
  const camera = /拍照|摄影|相机|影像|camera|vlog/i.test(request);
  const battery = context.userProfile.batteryPriority === "high" || /续航|电池|battery|通勤/i.test(request);
  const screen = /屏幕|追剧|观影|screen|绘画/i.test(request);
  const fields = new Set([
    "evidenceNote", "chip", "chipNote", "memory", "storage", "screenSize", "refreshRate", "refreshRateNote", "weight", "weightNote",
    "priceConfiguration", "priceCondition",
    "compatibility", "positioning", "sensors", "healthFeatures", "wearableFeatures", "sportsModes", "waterResistance", "cellular", "wearableNote",
    ...(camera ? ["mainCamera", "telephoto", "frontCamera", "frontCameraNote", "dxomarkCamera", "dxomarkNote"] : []),
    ...(battery ? ["batteryLife", "batteryCapacityMah", "chargingMethod"] : []),
    ...(screen ? ["displayType"] : []),
  ]);
  const quoteFields = new Set(["memory", "storage", "chip", "cpu", "gpu", "priceConfiguration", "priceCondition"]);
  const modelContext = {
    userProfile: context.userProfile,
    candidateShortlist: context.candidateShortlist.map((candidate) => ({
      deviceId: candidate.deviceId,
      model: candidate.model,
      category: candidate.category,
      releaseYear: candidate.releaseYear,
      quotes: candidate.quotes.map((quote) => ({
        quoteId: quote.quoteId,
        referencePrice: quote.referencePrice,
        priceType: quote.priceType,
        sourceName: quote.sourceName,
        observedAt: quote.observedAt,
        facts: Object.fromEntries(Object.entries(quote.facts).filter(([key]) => quoteFields.has(key))),
      })),
      facts: Object.fromEntries(Object.entries(candidate.facts).filter(([key]) => !quoteFields.has(key) && (fields.has(key)
        || (candidate.category === "laptop" && ["cpu", "gpu", "port", "thunderbolt"].includes(key))
        || (candidate.category === "tablet" && key === "pencilSupport")
        || (context.userProfile.interfaceNeed !== "any" && key === "port")))),
    })),
  };
  return [
    "你是 DeviceScope 的设备顾问。",
    `本次最多推荐 ${context.userProfile.maxResults} 台设备；先选定设备和一笔报价，再写正文。正文不要讨论未选设备或其他配置报价。`,
    ...(selection ? ["这是正文一致性重试，输入已收窄到上次选中的设备与报价。请重新生成完整 JSON，不讨论输入以外的其他选择。"] : []),
    "本地先按设备类型和明确的接口兼容性要求筛选，再按已收录的对应成色价格和发布时间整理候选；你负责结合用户场景给出自然、完整的中文购买建议。",
    "只能推荐 candidateShortlist 中的设备，不允许编造机型、价格或 facts 中没有的规格。",
    "facts 按本次需求筛选；未提供某字段不等于设备没有该能力。信息不足时明确说明，不能用模型记忆补齐。",
    "尤其不要自行补充风扇/散热结构、持续性能或降频、续航小时数、软件兼容性；没有对应证据时不能据此比较优劣。参数高低不等于实测体验优劣。",
    "answer 用 150 到 300 个汉字说明推荐哪几款、为什么以及主要取舍，不使用 Markdown、列表或虚构的精确评分。",
    "referencePrice 是 priceType 标明的 current 当前价或 used 二手价；sourceName/observedAt 是报价来源/采集日期，不是实时价格。首发价仅供历史参考，不代表当前市场价，也不得用于判断是否符合预算。referencePrice 为 null 时必须明确价格未知。",
    "每笔报价仅对应 priceConfiguration 和 priceCondition；必须说明对应配置与二手成色/优惠限制，不得把机型其他可选配置或最高规格套用到该价格。",
    "每个设备 quotes 最多两笔可选报价；设备 facts 是通用事实，quote.facts 才是对应报价的配置事实。只能讨论最终选中的报价，不把同机型另一报价的配置套用过来。",
    "minMemoryGb 和 minStorageGb 是明确的最低配置要求；没有符合要求的已核验报价时，应说明数据不足，不得自行降低要求。used_ok 表示全新和二手都可考虑，并非必须推荐二手。预算上限不是消费目标，不必花满预算。",
    "DXOMARK 分数必须连同协议版本理解；协议不同的分数不可直接比较高低。",
    "batteryCapacityMah 是电池容量，不是续航时长；不能仅凭 mAh 大小判断谁更耐用，也不能换算为使用小时。batteryLife 缺失时说明缺少续航证据。",
    "有预算时必须逐项比较 referencePrice 与 min、max；低于 min 或高于 max 的设备必须明确写为预算外，不得称为预算内；已有预算内候选时优先推荐预算内候选。",
    "recommendedDeviceIds 按推荐顺序给出 deviceId，数量不得超过 userProfile.maxResults，并且与 answer 中提到的设备保持一致；确实没有合适设备时可返回空数组并在 answer 中解释。",
    "recommendedQuoteIds 与 recommendedDeviceIds 等长、逐项对应，必须使用该设备 quotes 中的 quoteId；每个设备只选一笔报价，价格未知的占位报价也必须引用。无推荐时两个数组均为空。",
    "answer 只讨论最终 recommendedDeviceIds 中的设备，不列举其他候选的参数或评价；不要扩展为整库机型点评。",
    "confidence 为 0 到 1，只供系统内部评测。",
    "只返回纯 JSON，对象字段必须且只能包含 answer、recommendedDeviceIds、recommendedQuoteIds、confidence。",
    "",
    "输入数据：",
    JSON.stringify(modelContext),
    "",
    "请直接返回 JSON，例如：{\"answer\":\"...\",\"recommendedDeviceIds\":[\"device-id\"],\"recommendedQuoteIds\":[\"device-id:q0\"],\"confidence\":0.8}",
  ].join("\n");
}
