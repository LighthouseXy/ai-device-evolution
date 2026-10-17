import type { DeviceCategory } from "@/lib/device-categories";
import type { FlattenedDevice } from "@/lib/devices-db";
import { formatConfiguration, getDeviceConfigurations } from "@/lib/device-configurations";

type SpecField = {
  group: string; key: string; label: string; unit?: string; core?: boolean;
  categories?: DeviceCategory[]; brands?: string[];
};

const cameraKeys = ["rearCamera", "mainCamera", "ultraWide", "telephoto", "wideCamera", "macroCamera", "depthCamera", "colorCamera", "opticalZoom"];

// 通用核心参数保留缺口；品牌专有功能和扩展参数仅在有实际记录时展示。
const fields: SpecField[] = [
  { group: "性能", key: "chip", label: "芯片", core: true, categories: ["phone", "tablet", "laptop"] },
  { group: "性能", key: "wearableChip", label: "芯片", categories: ["watch", "band"] },
  { group: "性能", key: "memory", label: "运行内存", core: true, categories: ["phone", "tablet", "laptop"] },
  { group: "性能", key: "storage", label: "存储", core: true, categories: ["phone", "tablet", "laptop"] },
  { group: "性能", key: "onboardStorage", label: "机身存储", categories: ["watch", "band"] },
  { group: "性能", key: "memoryType", label: "内存类型" },
  { group: "性能", key: "storageType", label: "存储类型" },
  { group: "性能", key: "operatingSystem", label: "操作系统" },
  { group: "性能", key: "cpu", label: "CPU" },
  { group: "性能", key: "gpu", label: "GPU" },
  { group: "性能", key: "neuralEngine", label: "神经引擎", brands: ["Apple"] },
  { group: "显示", key: "screenSize", label: "屏幕尺寸", unit: " 英寸", core: true, categories: ["phone", "tablet", "laptop"] },
  { group: "显示", key: "screenSize", label: "屏幕尺寸", unit: " 英寸", categories: ["watch", "band"] },
  { group: "显示", key: "displayType", label: "屏幕类型", core: true },
  { group: "显示", key: "resolution", label: "分辨率", core: true },
  { group: "显示", key: "refreshRate", label: "刷新率", unit: "Hz" },
  { group: "显示", key: "peakBrightness", label: "峰值亮度", unit: " 尼特" },
  { group: "影像", key: "rearCamera", label: "后置摄像头", categories: ["phone", "tablet"], core: true },
  { group: "影像", key: "mainCamera", label: "主摄", categories: ["phone", "tablet"] },
  { group: "影像", key: "ultraWide", label: "超广角", categories: ["phone", "tablet"] },
  { group: "影像", key: "telephoto", label: "长焦", categories: ["phone", "tablet"] },
  { group: "影像", key: "wideCamera", label: "广角", categories: ["phone", "tablet"] },
  { group: "影像", key: "macroCamera", label: "微距", categories: ["phone", "tablet"] },
  { group: "影像", key: "depthCamera", label: "景深 / 深感", categories: ["phone", "tablet"] },
  { group: "影像", key: "colorCamera", label: "色彩镜头", categories: ["phone", "tablet"] },
  { group: "影像", key: "opticalZoom", label: "光学变焦", categories: ["phone", "tablet"] },
  { group: "影像", key: "frontCamera", label: "前置摄像头", categories: ["phone", "tablet"], core: true },
  { group: "影像", key: "videoRecording", label: "视频拍摄", categories: ["phone", "tablet"] },
  { group: "影像", key: "webcam", label: "摄像头", categories: ["laptop"] },
  { group: "影像", key: "wearableCamera", label: "摄像头", categories: ["watch"] },
  { group: "续航", key: "batteryCapacity", label: "电池容量", unit: "mAh" },
  { group: "续航", key: "batteryCapacityDetails", label: "电池容量", categories: ["watch", "band"] },
  { group: "续航", key: "batteryLife", label: "电池续航" },
  { group: "续航", key: "chargingMethod", label: "充电方式" },
  { group: "续航", key: "chargingTime", label: "充电时间", categories: ["watch", "band"] },
  { group: "续航", key: "powerAdapter", label: "电源适配器" },
  { group: "续航", key: "wirelessWebBrowsing", label: "无线网络浏览", brands: ["Apple"] },
  { group: "健康与运动", key: "healthFeatures", label: "健康记录", categories: ["watch", "band"] },
  { group: "健康与运动", key: "sportsModes", label: "运动功能", categories: ["watch", "band"] },
  { group: "健康与运动", key: "sensors", label: "传感器", categories: ["watch", "band"] },
  { group: "连接", key: "compatibility", label: "手机兼容性", categories: ["watch", "band"] },
  { group: "连接", key: "positioning", label: "卫星定位", categories: ["watch", "band"] },
  { group: "连接", key: "cellular", label: "蜂窝网络", categories: ["watch", "band"] },
  { group: "连接", key: "connectivity", label: "连接方式", categories: ["watch", "band"] },
  { group: "连接", key: "port", label: "接口", core: true, categories: ["phone", "tablet", "laptop"] },
  { group: "连接", key: "usbC", label: "USB-C" },
  { group: "连接", key: "thunderbolt", label: "雷雳", categories: ["laptop", "tablet"] },
  { group: "连接", key: "wifi", label: "无线网络" },
  { group: "连接", key: "bluetooth", label: "蓝牙" },
  { group: "连接", key: "sim", label: "SIM", categories: ["phone", "tablet"] },
  { group: "连接", key: "externalDisplay", label: "外接显示器", categories: ["laptop", "tablet"] },
  { group: "功能", key: "security", label: "安全验证" },
  { group: "功能", key: "wearableFeatures", label: "功能说明", categories: ["watch", "band"] },
  { group: "功能", key: "waterResistance", label: "防护等级", categories: ["phone", "tablet", "watch", "band"] },
  { group: "功能", key: "hasNFC", label: "NFC" },
  { group: "功能", key: "hasUWB", label: "UWB" },
  { group: "功能", key: "hasMagSafe", label: "MagSafe", brands: ["Apple"] },
  { group: "功能", key: "hasSOS", label: "SOS" },
  { group: "功能", key: "hasCrashDetection", label: "车祸检测", brands: ["Apple"] },
  { group: "功能", key: "hasTouchId", label: "Touch ID", brands: ["Apple"] },
  { group: "配件", key: "pencilSupport", label: "手写笔", categories: ["tablet"] },
  { group: "配件", key: "magicKeyboard", label: "妙控键盘", categories: ["tablet"], brands: ["Apple"] },
  { group: "配件", key: "keyboard", label: "键盘", categories: ["laptop", "tablet"] },
  { group: "配件", key: "trackpad", label: "触控板", categories: ["laptop", "tablet"] },
  { group: "配件", key: "speakers", label: "扬声器" },
  { group: "配件", key: "microphone", label: "麦克风" },
  { group: "机身", key: "weight", label: "重量", unit: "g", core: true, categories: ["phone", "tablet", "laptop"] },
  { group: "机身", key: "wearableWeight", label: "重量（按版本）", categories: ["watch", "band"] },
  { group: "机身", key: "dimensions", label: "尺寸" },
  { group: "机身", key: "caseSize", label: "表壳尺寸", categories: ["watch", "band"] },
  { group: "机身", key: "strapMaterial", label: "表带材质", categories: ["watch", "band"] },
  { group: "机身", key: "material", label: "材质" },
  { group: "机身", key: "colors", label: "颜色" },
];

function hasValue(device: FlattenedDevice, key: string) {
  const value = device.specs?.[key];
  return (value !== undefined && value !== null && value !== "")
    || Boolean(device.configurations?.some((configuration) => key === "cpu" ? configuration.cpuCores
      : key === "gpu" ? configuration.gpuCores : key === "chip" ? configuration.chip : false));
}

function configurationSpec(device: FlattenedDevice, key: string) {
  const property = key === "cpu" ? "cpuCores" : key === "gpu" ? "gpuCores" : key === "chip" || key === "memory" ? key : null;
  if (!property) return "";
  const validKeys = new Set(getDeviceConfigurations(device).map((configuration) => configuration.key));
  const multipleChips = new Set(device.configurations?.map(configuration => configuration.chip).filter(Boolean)).size > 1;
  const groups = new Map<string, Set<string>>();
  for (const configuration of device.configurations ?? []) {
    const value = configuration[property];
    if (!value || !validKeys.has(`${configuration.memory}|${configuration.storage}`)) continue;
    const label = typeof value === "number" ? `${value} 核 ${key.toUpperCase()}` : value;
    const options = groups.get(label) ?? new Set<string>();
    options.add(key === "memory" ? configuration.storage : `${formatConfiguration({ ...configuration, key: "" })}${multipleChips && key !== "chip" && configuration.chip ? ` · ${configuration.chip}` : ""}`);
    groups.set(label, options);
  }
  if (groups.size < 2) return [...groups.keys()][0] ?? "";
  // 仅标注已记录的配置矩阵；不根据两组容量选项推导任意组合。
  return [...groups].map(([value, options]) => `${value}（${[...options].join(" / ")}${key === "memory" ? " 存储" : ""}）`).join("\n");
}

export function getDeviceSpecFields(devices: FlattenedDevice[]) {
  const cameras = new Map(devices.map(device => [device, getCameraDetailPresentation(device)]));
  return fields.filter((field) => devices.some((device) =>
    (!field.categories || field.categories.includes(device.category))
    && (!field.brands || field.brands.includes(device.brand))
    && (field.key in cameras.get(device)!.values ? Boolean(cameras.get(device)!.values[field.key])
      : field.core || hasValue(device, field.key))));
}

export function splitDeviceSpecDescription(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if ("(（[【".includes(character)) depth++;
    else if (")）]】".includes(character)) depth = Math.max(0, depth - 1);
    // 括号内的分号/换行属于同一配置条件，不拆成独立规格。
    else if (!depth && "；;\n".includes(character)) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

export function getCameraDetailPresentation(device: FlattenedDevice) {
  const keys = cameraKeys;
  const lensKeys = keys.slice(1, -1);
  const mainCrop = /光学品质[^；;]*长焦|同时支持[^；;]*长焦功能|长焦[^；;]*通过四合一像素传感器实现/;
  const values: Record<string, string> = {};
  const notes: Record<string, string> = {};
  const rear = String(device.specs?.rearCamera ?? "").trim();
  const normalize = (value: string) => value.toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(万|亿)像素/g, (_, number, unit) => `${Number(number) * (unit === "亿" ? 100 : .01)}mp`)
    .replace(/(?:超广角|广角|主摄|长焦|摄像头|镜头)|[\s，,:：;；()（）]/g, "")
    .replace(/(\d+(?:\.\d+)?mp)\1/g, "$1");
  const add = (target: Record<string, string>, key: string, part: string) => {
    const current = target[key];
    if (!current) target[key] = part;
    else if (normalize(current) === normalize(part)) return;
    else if (normalize(part).includes(normalize(current))) target[key] = part;
    else if (!normalize(current).includes(normalize(part))) target[key] += `；${part}`;
  };
  for (const key of keys) {
    const value = String(device.specs?.[key] ?? "").trim();
    // 系统总述不能冒充某一个镜头的参数，但原文会保留在组合说明中。
    values[key] = key !== "rearCamera" && /(?:摄像头|双摄|三摄|四摄).*系统/.test(value) ? "" : value;
    if (device.specs?.[`${key}Note`]) notes[key] = String(device.specs[`${key}Note`]);
  }
  const croppedTelephoto = mainCrop.test(values.telephoto) ? values.telephoto : "";
  if (croppedTelephoto) values.telephoto = "";
  const unassigned: string[] = [];
  const chunks = splitDeviceSpecDescription(rear.replace(/后置摄像头\d+\s*[:：]?\s*/g, "；"));
  const parts = chunks.flatMap(chunk => {
    // 多镜头共用的光圈列表未建立逐镜头对应，不能把整组光圈归给一个镜头。
    if (/f\/?\d+(?:\.\d+)?\s*\+\s*f\/?\d/i.test(chunk)) return [chunk];
    // 仅在括号外拆镜头组合；光圈 f/1.8+f/2.2 和括号内配置条件保持完整。
    const pieces: string[] = [];
    let depth = 0, start = 0;
    for (let index = 0; index < chunk.length; index++) {
      if ("(（[【".includes(chunk[index])) depth++;
      else if (")）]】".includes(chunk[index])) depth = Math.max(0, depth - 1);
      else if (!depth && chunk[index] === "+" && /^\s*(?:\d+(?:\.\d+)?\s*(?:万|亿)像素|\d+(?:\.\d+)?MP|主摄|超广角|广角|长焦|微距|景深|3D|红枫)/i.test(chunk.slice(index + 1))) {
        pieces.push(chunk.slice(start, index).trim()); start = index + 1;
      }
    }
    pieces.push(chunk.slice(start).trim());
    return pieces.flatMap(part => /[，,:：()（）]/.test(part) ? [part]
      : part.split(/\s+(?=\d+(?:\.\d+)?\s*(?:万|亿)像素\S*(?:主摄|超广角|长焦))/));
  }).filter(Boolean);
  if (/^另有/.test(notes.rearCamera ?? "")) parts.push(notes.rearCamera);
  for (const part of parts) {
    if (/(?:摄像头|双摄|三摄|四摄).*系统/.test(part)
      || /f\/?\d+(?:\.\d+)?\s*\+\s*f\/?\d/i.test(part)
      || (/主摄|主镜头/.test(part) && /超广角/.test(part))
      || /(?:广角|长焦|超广角)(?:和|及|、)(?:广角|长焦|超广角)/.test(part)) { unassigned.push(part); continue; }
    // 主摄裁切的“光学品质长焦”不是独立长焦镜头，按原文归入主摄。
    const key = mainCrop.test(part) ? "mainCamera"
      : /超广角/.test(part) ? "ultraWide"
      : /长焦/.test(part) ? "telephoto"
      : /主摄|主镜头/.test(part) ? "mainCamera"
      : /景深|深感/.test(part) ? "depthCamera"
      : /红枫|丹霞|原色摄像头|色彩.*镜头/.test(part) ? "colorCamera"
      : /微距/.test(part) ? "macroCamera"
      : /广角/.test(part) ? (/广角/.test(String(device.specs?.mainCamera ?? "")) ? "mainCamera" : "wideCamera")
      : "";
    if (!key) {
      // 已明确对应某镜头的原文（如哈苏人像、连续光学变焦）可以去重，不依靠编号猜镜头。
      if (!keys.slice(1).some(key => values[key] && normalize(values[key]).includes(normalize(part)))) unassigned.push(part);
      continue;
    }
    const currentMp = normalize(values[key]).match(/\d+(?:\.\d+)?mp/)?.[0];
    const incomingMp = normalize(part).match(/\d+(?:\.\d+)?mp/)?.[0];
    if (key === "mainCamera" && currentMp && incomingMp && currentMp !== incomingMp
      && !mainCrop.test(part) && !mainCrop.test(values[key])) add(notes, key, `原始总述另记：${part}`);
    else add(values, key, part);
    if (part === notes.rearCamera) delete notes.rearCamera;
  }
  if (croppedTelephoto) add(values, "mainCamera", croppedTelephoto);
  if (lensKeys.some(key => values[key])) {
    values.rearCamera = "";
    const target = values.mainCamera ? "mainCamera" : lensKeys.find(key => values[key])!;
    if (unassigned.length) add(notes, target, `后置镜头组合原文：${unassigned.join("；")}`);
    if (notes.rearCamera) add(notes, target, notes.rearCamera);
  }
  return { values, notes };
}

export function getDeviceSpecNote(device: FlattenedDevice, key: string) {
  return (cameraKeys.includes(key) ? getCameraDetailPresentation(device).notes[key] : undefined) ?? device.specs?.[`${key}Note`];
}

export function formatDeviceSpec(device: FlattenedDevice, field: SpecField): string {
  if ((field.categories && !field.categories.includes(device.category))
    || (field.brands && !field.brands.includes(device.brand))) return "—";
  if (device.editions && device.editions.length > 1 && field.key !== "colors") {
    const values = device.editions.map(edition => formatDeviceSpec(edition.device, field));
    if (values.every(value => value === values[0])) return values[0];
    return device.editions.map((edition, index) => {
      const value = values[index];
      const prefix = value.split(/[:：]/)[0];
      // 原字段已带确切款式名时不重复堆叠“星芒白：星芒白…”。条件本身仍保留。
      return prefix && edition.label.includes(prefix) && value.includes("：") ? `${edition.label}：${value.slice(prefix.length + 1).trim()}`
        : `${edition.label}：${value}`;
    }).join("\n");
  }
  if (cameraKeys.includes(field.key)) return getCameraDetailPresentation(device).values[field.key] || (field.key === "rearCamera" ? "—" : "待补充");
  if (!hasValue(device, field.key)) return "待补充";
  const configurationValue = configurationSpec(device, field.key);
  const value = field.key === "screenSize" && device.specs?.screenSizeDetails ? device.specs.screenSizeDetails : device.specs?.[field.key];
  if (typeof value === "boolean") return value ? "支持" : "不支持";
  // 字符串可能已包含单位/测试条件，不重复拼接；数值仅使用字段定义的单位。
  const formatted = value != null && value !== "" ? `${value}${typeof value === "number" ? field.unit ?? "" : ""}` : "";
  // 配置矩阵可能只覆盖部分 SKU，保留原始选项汇总，不把未建立对应关系的选项隐去。
  if (configurationValue.includes("\n")) return formatted ? `${formatted}\n${configurationValue}` : configurationValue;
  return formatted || configurationValue || "待补充";
}
