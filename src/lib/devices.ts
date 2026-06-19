// ==================== 设备数据处理模块 ====================
// 本模块负责：
// 1. 加载和类型化设备数据
// 2. 提供数据查询和筛选函数
// 3. 格式化显示值

import devices from "@/data/devices.json";

// ==================== 类型定义 ====================
// 产品类别：手机、平板、笔记本
export type DeviceCategory = "phone" | "tablet" | "laptop";

// 机型档位：不同产品线共用，页面只做展示，不参与核心计算
export type DeviceTier =
  | "base"      // 标准版（如 iPhone 16）
  | "mini"      // mini 版（如 iPad mini）
  | "air"       // Air 版（如 MacBook Air）
  | "pro"       // Pro 版（如 iPhone 16 Pro）
  | "pro_max"   // Pro Max 版（如 iPhone 16 Pro Max）
  | "m"         // M 系列基础版（如 MacBook Pro M4）
  | "m_pro"     // M Pro 版（如 MacBook Pro M4 Pro）
  | "m_max";    // M Max 版（如 MacBook Pro M4 Max）

// 设备详细规格的键值对类型
export type DeviceSpecs = Record<string, string | number | boolean | undefined>;

// ==================== 设备数据结构定义 ====================
// 单个设备的核心字段定义，和 src/data/devices.json 中每条数据保持一致
// 顶层字段用于通用趋势计算，specs 用于保存不同产品线的详细参数
export type Device = {
  id: string;                    // 唯一标识符，如 "iphone_16"
  brand: string;                 // 品牌，如 "Apple"
  category: DeviceCategory;      // 产品类别
  series: string;                // 系列名称，如 "iPhone"、"iPhone Pro"
  tier: DeviceTier;              // 机型档位
  model: string;                 // 完整型号名称，如 "iPhone 16"
  generation: number;            // 代际数，用于排序和折线图
  releaseYear: number;           // 发布年份
  chip: string;                  // 芯片名称，如 "A19"、"Apple M5"
  screenSize: number;            // 屏幕尺寸（英寸）
  refreshRate?: number;          // 刷新率（Hz），如 60、120
  mainCameraMp?: number;         // 主摄像头像素数
  telephoto?: string;            // 长焦镜头描述
  port?: string;                 // 接口类型，如 "USB-C"、"Lightning"
  weight?: number;               // 重量（克）
  launchPrice?: number;          // 首发价格（人民币）
  aiFeatureLevel?: number;       // AI 能力等级（0-10）
  sourceUrl: string;             // 数据来源 URL
  specs?: DeviceSpecs;           // 详细规格参数（不同产品线可能不同）
};

// ==================== 数据加载 ====================
// 将 JSON 数据转成有类型的设备数组，方便页面和分析函数获得 TypeScript 提示
export const allDevices = devices as Device[];

// ==================== 分类和系列查询 ====================
// 产品类别到中文标签的映射
export const categoryLabels: Record<DeviceCategory, string> = {
  phone: "iPhone",
  tablet: "iPad",
  laptop: "MacBook",
};

// 从数据中提取所有唯一的产品类别
export const categoryNames = Array.from(
  new Set(allDevices.map((device) => device.category)),
) as DeviceCategory[];

// 从数据中提取所有唯一的系列名称（如 iPhone、iPhone Pro、iPad Pro 13-inch）
export const seriesNames = Array.from(new Set(allDevices.map((device) => device.series)));

// 根据产品类别获取该类别下的所有系列
// 例如：category="phone" 返回 ["iPhone", "iPhone Pro"]
export const getSeriesByCategory = (category: DeviceCategory) =>
  Array.from(
    new Set(
      allDevices
        .filter((device) => device.category === category)
        .map((device) => device.series),
    ),
  );

// 根据系列名称获取该系列下的所有设备，按代际排序
// 例如：series="iPhone" 返回 [iPhone 12, iPhone 13, ..., iPhone 17]
export const getDevicesBySeries = (series: string) =>
  allDevices
    .filter((device) => device.series === series)
    .sort((a, b) => a.generation - b.generation);

// 时间轴展示用的数据：先按系列分组排序，再按代际从旧到新排序
export const timelineDevices = [...allDevices].sort((a, b) => {
  if (a.series !== b.series) {
    return a.series.localeCompare(b.series);
  }

  return a.generation - b.generation;
});

// ==================== 格式化工具函数 ====================
// 首发价格以人民币格式显示，如 "¥5,999"
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);

// 紧凑格式显示价格，用于折线图标签，如 "5999" → "5,999" 或 "8.5k"
export const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

// 安全格式化价格：如果有值显示人民币格式，否则显示"待补充"
export const formatMaybeCurrency = (value?: number) =>
  typeof value === "number" ? formatCurrency(value) : "待补充";

// ==================== 统计数据 ====================
// 首页顶部的概览指标，直接从数据源派生，新增机型后会自动更新
export const summaryStats = {
  modelCount: allDevices.length,                                    // 总机型数
  categoryCount: categoryNames.length,                              // 产品类别数
  seriesCount: seriesNames.length,                                  // 系列数
  startYear: Math.min(...allDevices.map((device) => device.releaseYear)),  // 最早年份
  endYear: Math.max(...allDevices.map((device) => device.releaseYear)),    // 最晚年份
  fieldsTracked: 18,                                                // 跟踪的字段数
};
