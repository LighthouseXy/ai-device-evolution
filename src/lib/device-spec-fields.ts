import type { DeviceCategory } from "@/lib/device-categories";
import type { FlattenedDevice } from "@/lib/devices-db";
import { formatConfiguration, getDeviceConfigurations } from "@/lib/device-configurations";

type SpecField = {
  group: string; key: string; label: string; unit?: string; core?: boolean;
  categories?: DeviceCategory[]; brands?: string[];
};

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
  return fields.filter((field) => devices.some((device) =>
    (!field.categories || field.categories.includes(device.category))
    && (!field.brands || field.brands.includes(device.brand))
    && (field.core || hasValue(device, field.key))));
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
  const lensFields = fields.filter(field => ["mainCamera", "ultraWide", "telephoto"].includes(field.key));
  const rearCamera = device.specs?.rearCamera;
  // 有些历史数据把同一双摄总述写进两个镜头字段，不能把它当成独立镜头规格。
  const omittedLensKeys = lensFields.filter(field => {
    const value = device.specs?.[field.key];
    return typeof value === "string" && typeof rearCamera === "string" && rearCamera.includes(value)
      && !device.specs?.[`${field.key}Note`] && lensFields.filter(lens => value.includes(lens.label)).length > 1
      && lensFields.some(lens => lens.key !== field.key && device.specs?.[lens.key] === value);
  }).map(field => field.key);
  const lenses = lensFields.filter(field => !omittedLensKeys.includes(field.key)
    && typeof device.specs?.[field.key] === "string" && String(device.specs[field.key]).trim());
  if (lenses.length < 2) return { omittedLensKeys, supplement: undefined };
  if (rearCamera == null || rearCamera === "") return { omittedLensKeys, supplement: "" };
  if (typeof rearCamera !== "string") return { omittedLensKeys, supplement: undefined };
  const normalize = (value: string) => value.replace(/[\s，,:：()（）]/g, "").toLowerCase();
  const represented = lenses.flatMap(field => {
    const value = String(device.specs?.[field.key]);
    return [value, `${field.label}${value}`, `${value}${field.label}`].map(normalize);
  });
  if (typeof device.specs?.opticalZoom === "string") represented.push(normalize(device.specs.opticalZoom));
  // 仅去掉可确认已在分项中出现的原文段落；不进行语义猜测，也不删除未覆盖的镜头信息。
  const supplement = rearCamera.split(/[；;\n]+|\s+\+\s+/).map(part => part.trim()).filter(Boolean)
    .filter(part => !represented.some(value => value.includes(normalize(part)))).join("；");
  return { omittedLensKeys, supplement };
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
