"use client";

import { useEffect, useMemo, useState } from "react";
import type { Device, DeviceCategory } from "@/lib/devices-db";
import type { AiAnalysisOutput, AnalysisType } from "@/lib/ai-analysis";
import {
  categoryLabels,
  categoryNames,
  formatCompactCurrency,
  formatMaybeCurrency,
  getDevicesBySeriesFlat as getDevicesBySeries,
  getSeriesByCategoryFlat as getSeriesByCategory,
  summaryStatsFlat as summaryStats,
} from "@/lib/devices-db";

// ==================== 类型定义 ====================
// 折线图可切换的指标类型：价格、屏幕尺寸、处理器、摄像头、接口、重量、AI能力
type MetricKey = "price" | "screen" | "chip" | "camera" | "port" | "weight" | "ai";
// 对比范围：近3代、全部
type RangeKey = "recent3" | "all";
// 功能分类：设计、显示屏、芯片与智能、摄像头、电池、防护与安全、网络连接、配件支持、输入设备、摄像头与音频
type CategoryKey =
  | "price"
  | "design"
  | "display"
  | "chip_intelligence"
  | "camera"
  | "battery"
  | "protection"
  | "connectivity"
  | "accessories"
  | "input"
  | "camera_audio";

// 折线图快捷切换按钮的配置
type QuickMetric = {
  key: MetricKey;
  label: string;
};

type AnalysisMode = {
  key: AnalysisType;
  label: string;
};

// 折线图下方显示的快捷切换按钮列表
const quickMetrics: QuickMetric[] = [
  { key: "chip", label: "芯片" },
  { key: "screen", label: "尺寸" },
  { key: "weight", label: "重量" },
  { key: "price", label: "价格" },
  { key: "ai", label: "AI 能力" },
];

const analysisModes: AnalysisMode[] = [
  { key: "generation_summary", label: "总结" },
  { key: "trend_prediction", label: "预测" },
  { key: "buying_advice", label: "建议" },
  { key: "comparison_explanation", label: "解释" },
];

// ==================== 折线图指标配置 ====================
// 每个指标包含：显示标签、获取显示值的函数、获取图表数值的函数
type MetricConfig = {
  key: MetricKey;
  label: string;
  getValue: (device: Device) => string;      // 用于表格中显示的文本值
  getChartValue: (device: Device) => number | undefined;  // 用于折线图的数值
};

// 详细对比表格中的每一行配置
type SpecItem = {
  label: string;
  sourceLabel?: string;  // 显示在表格中的小字说明
  getValue: (device: Device) => string;
};

// 功能分类配置，包含多个规格项
type ComparisonCategory = {
  key: CategoryKey;
  label: string;
  sourceLabel: string;
  description: string;
  trendMetric?: MetricKey;  // 关联的折线图指标
  specs: SpecItem[];         // 该分类下的所有规格项
};

// 缺失数据的统一占位符
const pending = "—";

// ==================== 数据处理工具函数 ====================

// 从设备的 specs 对象中获取指定字段的文本值
// 如果字段不存在或类型不对，返回"—"
const specText = (device: Device, key: string) => {
  const value = device.specs?.[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return pending;
};

// 从 specs 中获取可选字段，不存在时返回 undefined
const specOptional = (device: Device, key: string): string | undefined => {
  const value = device.specs?.[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
};

// 从多个候选字段中获取第一个有效值
// 用于处理不同设备可能使用不同字段名的情况
const firstAvailable = (device: Device, keys: string[]) => {
  const value = keys.map((key) => specText(device, key)).find((item) => item !== pending);
  return value ?? pending;
};

// 获取摄像头显示值：优先使用 specs 中的详细描述，否则显示像素数
const cameraValue = (device: Device) => {
  const rearCamera = firstAvailable(device, ["rearCamera", "camera"]);

  if (rearCamera !== pending) {
    return rearCamera;
  }

  return typeof device.mainCameraMp === "number" ? `${device.mainCameraMp}MP` : pending;
};

// 获取重量显示值：优先使用 specs 中的文本描述（如"1.24 千克"），否则显示克数
const weightValue = (device: Device) => {
  const weightText = specText(device, "weightText");

  if (weightText !== pending) {
    return weightText;
  }

  return typeof device.weight === "number" ? `${device.weight}g` : pending;
};

// 获取 AI 能力显示值：显示为 "8/10" 格式
const aiValue = (device: Device) =>
  typeof device.aiFeatureLevel === "number" ? `${device.aiFeatureLevel}/10` : pending;

// ==================== 芯片性能评分映射 ====================
// 根据 Apple 芯片代际和性能等级映射为可比较的数值
// A 系列芯片性能评分（数值越高性能越强）
const chipPerformanceMap: Record<string, number> = {
  "A14 Bionic": 100,
  "A15 Bionic": 120,
  "A16 Bionic": 140,
  "A17 Pro": 170,
  "A18": 190,
  "A18 Pro": 210,
  "A19": 230,
  "A19 Pro": 250,
  // M 系列芯片
  "Apple M1": 150,
  "Apple M1 Pro": 180,
  "Apple M1 Max": 210,
  "Apple M1 Ultra": 250,
  "Apple M2": 170,
  "Apple M2 Pro": 200,
  "Apple M2 Max": 230,
  "Apple M2 Ultra": 270,
  "Apple M3": 190,
  "Apple M3 Pro": 220,
  "Apple M3 Max": 260,
  "Apple M4": 210,
  "Apple M4 Pro": 250,
  "Apple M4 Max": 290,
  "Apple M5": 240,
  "Apple M5 Pro": 280,
  "Apple M5 Max": 320,
};

// 获取芯片性能评分，未知芯片返回 0
const getChipPerformance = (chip: string): number => {
  // 精确匹配
  if (chipPerformanceMap[chip]) {
    return chipPerformanceMap[chip];
  }
  // 模糊匹配（处理带空格或不同命名格式的情况）
  const normalizedChip = chip.trim();
  for (const [key, value] of Object.entries(chipPerformanceMap)) {
    if (normalizedChip.includes(key) || key.includes(normalizedChip)) {
      return value;
    }
  }
  return 0;
};

// ==================== 折线图指标配置列表 ====================
// 定义每个指标的显示方式和数值获取方式
const metricConfigs: MetricConfig[] = [
  {
    key: "price",
    label: "💰 价格",
    getValue: (device) => formatMaybeCurrency(device.launchPrice),  // 格式化为人民币
    getChartValue: (device) => device.launchPrice,
  },
  {
    key: "screen",
    label: "尺寸",
    getValue: (device) => typeof device.screenSize === "number" ? `${device.screenSize} 英寸` : "—",
    getChartValue: (device) => typeof device.screenSize === "number" ? device.screenSize : undefined,
  },
  {
    key: "chip",
    label: "处理器",
    getValue: (device) => device.chip,           // 显示芯片名称如"A19"
    getChartValue: (device) => getChipPerformance(device.chip), // 用性能评分表示
  },
  {
    key: "camera",
    label: "📷 摄像头",
    getValue: cameraValue,
    getChartValue: (device) => device.mainCameraMp,  // 用像素数表示
  },
  {
    key: "port",
    label: "连接端口",
    getValue: (device) => device.port ?? firstAvailable(device, ["connector", "ports"]),
    getChartValue: (device) => (device.port?.includes("USB") ? 2 : device.port ? 1 : undefined), // USB=2, 其他=1
  },
  {
    key: "weight",
    label: "重量",
    getValue: weightValue,
    getChartValue: (device) => device.weight,  // 用克数表示
  },
  {
    key: "ai",
    label: "AI 能力",
    getValue: aiValue,
    getChartValue: (device) => device.aiFeatureLevel,  // 0-10分
  },
];

// 根据 key 获取对应的指标配置
const metricByKey = (key: MetricKey) =>
  metricConfigs.find((metric) => metric.key === key) ?? metricConfigs[0];

// ==================== 手机功能分类配置 ====================
// 根据 iPhone 官网比较页面重新设计的 8 个分类
const phoneCategories: ComparisonCategory[] = [
  {
    key: "price",
    label: "💰 价格",
    sourceLabel: "首发价格 / 实时价格 / 二手价格",
    description: "设备的首发价格、当前实时价格和二手市场价格。",
    trendMetric: "price",
    specs: [
      { label: "首发价格", sourceLabel: "首发价格", getValue: (device) => formatMaybeCurrency(device.launchPrice) },
      { label: "实时价格", sourceLabel: "实时价格", getValue: (device) => specOptional(device, "currentPrice") || "—" },
      { label: "二手价格", sourceLabel: "二手价格", getValue: (device) => specOptional(device, "usedPrice") || "—" },
    ],
  },
  {
    key: "design",
    label: "📱 设计",
    sourceLabel: "外观 / 颜色 / 材料 / 尺寸",
    description: "外观设计、颜色、材料、尺寸和重量。",
    trendMetric: "weight",
    specs: [
      { label: "颜色", sourceLabel: "外观：颜色", getValue: (device) => specText(device, "colors") },
      { label: "材料", sourceLabel: "外观：材料", getValue: (device) => specText(device, "material") },
      { label: "重量", sourceLabel: "重量", getValue: (device) => specOptional(device, "weightNote") || weightValue(device) },
      { label: "屏幕尺寸", getValue: (device) => specOptional(device, "screenSizeNote") || (typeof device.screenSize === "number" ? `${device.screenSize} 英寸` : "—") },
      { label: "尺寸", sourceLabel: "尺寸与重量", getValue: (device) => specOptional(device, "dimensionsNote") || specText(device, "dimensions") },
    ],
  },
  {
    key: "display",
    label: "🖥️ 显示屏",
    sourceLabel: "屏幕尺寸 / 显示技术 / ProMotion / 涂层",
    description: "屏幕尺寸、显示类型、刷新率、ProMotion 和特殊涂层。",
    trendMetric: "screen",
    specs: [
      { label: "屏幕尺寸", sourceLabel: "显示屏：屏幕尺寸", getValue: (device) => specOptional(device, "screenSizeNote") || (typeof device.screenSize === "number" ? `${device.screenSize} 英寸` : "—") },
      { label: "显示类型", sourceLabel: "显示屏", getValue: (device) => specText(device, "displayType") },
      {
        label: "刷新率",
        sourceLabel: "显示屏：ProMotion",
        getValue: (device) => (device.refreshRate ? `${device.refreshRate}Hz` : pending),
      },
      { label: "ProMotion", getValue: (device) => (device.refreshRate && device.refreshRate >= 120 ? "支持" : "不支持") },
      { label: "显示涂层", sourceLabel: "显示屏：涂层 / 纳米纹理", getValue: (device) => specText(device, "displayCoating") },
    ],
  },
  {
    key: "chip_intelligence",
    label: "⚡ 芯片与智能",
    sourceLabel: "芯片 / CPU / GPU / 神经网络引擎 / AI",
    description: "芯片性能、CPU/GPU 单元、神经网络引擎和 AI 能力。",
    trendMetric: "chip",
    specs: [
      { label: "芯片", sourceLabel: "处理器：芯片", getValue: (device) => device.chip },
      { label: "中央处理器", sourceLabel: "处理器：中央处理器", getValue: (device) => specText(device, "cpu") },
      { label: "图形处理器", sourceLabel: "处理器：图形处理器", getValue: (device) => specText(device, "gpu") },
      { label: "神经网络引擎", sourceLabel: "处理器：引擎", getValue: (device) => specText(device, "neuralEngine") },
      { label: "内存", sourceLabel: "内存", getValue: (device) => specText(device, "memory") },
      { label: "存储容量", sourceLabel: "存储容量", getValue: (device) => specOptional(device, "storageNote") || specText(device, "storage") },
      { label: "AI 能力等级", sourceLabel: "Apple 智能", getValue: aiValue },
      { label: "端侧智能基础", getValue: (device) => (device.aiFeatureLevel && device.aiFeatureLevel >= 7 ? "适合 Apple 智能能力展示" : "基础端侧智能能力") },
    ],
  },
  {
    key: "camera",
    label: "📷 摄像头",
    sourceLabel: "后置 / 前置 / 视频拍摄",
    description: "后置摄像头、前置摄像头、视频拍摄相关规格。",
    trendMetric: "camera",
    specs: [
      { label: "后置摄像头", sourceLabel: "摄像头", getValue: cameraValue },
      { label: "长焦", getValue: (device) => device.telephoto ?? pending },
      { label: "前置摄像头", getValue: (device) => specText(device, "frontCamera") },
      { label: "视频拍摄", sourceLabel: "视频拍摄", getValue: (device) => specText(device, "video") },
    ],
  },
  {
    key: "battery",
    label: "🔋 电池",
    sourceLabel: "电池续航 / 视频播放 / 充电方式",
    description: "电池续航、视频播放、充电方式和接口信息。",
    specs: [
      { label: "电池续航", sourceLabel: "电池", getValue: (device) => specOptional(device, "batteryNote") || specText(device, "battery") },
      { label: "视频播放", sourceLabel: "视频播放", getValue: (device) => specText(device, "videoPlayback") },
      { label: "充电方式", sourceLabel: "MagSafe / USB-C", getValue: (device) => firstAvailable(device, ["charging", "connector"]) },
      { label: "接口", getValue: (device) => device.port ?? firstAvailable(device, ["ports", "connector"]) },
    ],
  },
  {
    key: "protection",
    label: "🛡️ 防护与安全",
    sourceLabel: "防水等级 / 安全验证",
    description: "防水等级、安全验证和紧急安全能力。",
    specs: [
      { label: "防水等级", sourceLabel: "防溅、抗水、防尘", getValue: (device) => specText(device, "waterResistance") },
      { label: "安全验证", sourceLabel: "安全验证", getValue: (device) => specText(device, "security") },
    ],
  },
  {
    key: "connectivity",
    label: "📡 网络连接",
    sourceLabel: "无线网络 / 连接端口 / 蜂窝网络",
    description: "无线网络、蜂窝网络、接口和数据传输能力。",
    trendMetric: "port",
    specs: [
      { label: "连接端口", sourceLabel: "连接端口", getValue: (device) => device.port ?? firstAvailable(device, ["ports", "connector"]) },
      { label: "无线网络", sourceLabel: "无线网络", getValue: (device) => specText(device, "wireless") },
      { label: "蜂窝网络", sourceLabel: "蜂窝网络", getValue: (device) => specText(device, "cellular") },
      { label: "SIM 卡", sourceLabel: "SIM 卡", getValue: (device) => specText(device, "sim") },
    ],
  },
];

// ==================== 平板功能分类配置 ====================
// 与手机保持一致的8个分类
const tabletCategories: ComparisonCategory[] = [
  {
    key: "price",
    label: "💰 价格",
    sourceLabel: "首发价格 / 实时价格 / 二手价格",
    description: "设备的首发价格、当前实时价格和二手市场价格。",
    trendMetric: "price",
    specs: [
      { label: "首发价格", sourceLabel: "首发价格", getValue: (device) => formatMaybeCurrency(device.launchPrice) },
      { label: "实时价格", sourceLabel: "实时价格", getValue: (device) => specOptional(device, "currentPrice") || "—" },
      { label: "二手价格", sourceLabel: "二手价格", getValue: (device) => specOptional(device, "usedPrice") || "—" },
    ],
  },
  {
    key: "design",
    label: "📱 设计",
    sourceLabel: "外观 / 颜色 / 材料 / 尺寸",
    description: "外观设计、颜色、材料、尺寸和重量。",
    trendMetric: "weight",
    specs: [
      { label: "颜色", sourceLabel: "外观：颜色", getValue: (device) => specText(device, "colors") },
      { label: "材料", sourceLabel: "外观：材料", getValue: (device) => specText(device, "material") },
      { label: "重量", sourceLabel: "重量", getValue: (device) => specOptional(device, "weightNote") || weightValue(device) },
      { label: "屏幕尺寸", getValue: (device) => specOptional(device, "screenSizeNote") || (typeof device.screenSize === "number" ? `${device.screenSize} 英寸` : "—") },
      { label: "尺寸", sourceLabel: "尺寸与重量", getValue: (device) => specOptional(device, "dimensionsNote") || specText(device, "dimensions") },
    ],
  },
  {
    key: "display",
    label: "🖥️ 显示屏",
    sourceLabel: "屏幕尺寸 / 显示技术 / ProMotion / 涂层",
    description: "屏幕尺寸、显示类型、刷新率、ProMotion 和特殊涂层。",
    trendMetric: "screen",
    specs: [
      { label: "屏幕尺寸", sourceLabel: "显示屏：屏幕尺寸", getValue: (device) => specOptional(device, "screenSizeNote") || (typeof device.screenSize === "number" ? `${device.screenSize} 英寸` : "—") },
      { label: "显示类型", sourceLabel: "显示屏", getValue: (device) => specText(device, "displayType") },
      {
        label: "刷新率",
        sourceLabel: "显示屏：ProMotion",
        getValue: (device) => (device.refreshRate ? `${device.refreshRate}Hz` : pending),
      },
      { label: "ProMotion", getValue: (device) => (device.refreshRate && device.refreshRate >= 120 ? "支持" : "不支持") },
      { label: "显示涂层", sourceLabel: "显示屏：涂层 / 纳米纹理", getValue: (device) => specText(device, "displayCoating") },
    ],
  },
  {
    key: "chip_intelligence",
    label: "⚡ 芯片与智能",
    sourceLabel: "芯片 / CPU / GPU / 神经网络引擎 / AI",
    description: "芯片性能、CPU/GPU 单元、神经网络引擎和 AI 能力。",
    trendMetric: "chip",
    specs: [
      { label: "芯片", sourceLabel: "处理器：芯片", getValue: (device) => device.chip },
      { label: "中央处理器", sourceLabel: "处理器：中央处理器", getValue: (device) => specText(device, "cpu") },
      { label: "图形处理器", sourceLabel: "处理器：图形处理器", getValue: (device) => specText(device, "gpu") },
      { label: "神经网络引擎", sourceLabel: "处理器：引擎", getValue: (device) => specText(device, "neuralEngine") },
      { label: "内存", sourceLabel: "内存", getValue: (device) => specText(device, "memory") },
      { label: "存储容量", sourceLabel: "存储容量", getValue: (device) => specOptional(device, "storageNote") || specText(device, "storage") },
      { label: "AI 能力等级", sourceLabel: "Apple 智能", getValue: aiValue },
    ],
  },
  {
    key: "camera",
    label: "📷 摄像头",
    sourceLabel: "后置 / 前置 / 视频拍摄",
    description: "后置摄像头、前置摄像头、视频拍摄相关规格。",
    trendMetric: "camera",
    specs: [
      { label: "后置摄像头", sourceLabel: "摄像头", getValue: cameraValue },
      { label: "前置摄像头", getValue: (device) => specText(device, "frontCamera") },
      { label: "视频拍摄", sourceLabel: "视频拍摄", getValue: (device) => specText(device, "video") },
    ],
  },
  {
    key: "battery",
    label: "🔋 电池",
    sourceLabel: "电池续航 / 视频播放 / 充电方式",
    description: "电池续航、视频播放、充电方式和接口信息。",
    specs: [
      { label: "电池续航", sourceLabel: "电池", getValue: (device) => specOptional(device, "batteryNote") || specText(device, "battery") },
      { label: "视频播放", sourceLabel: "视频播放", getValue: (device) => specText(device, "videoPlayback") },
      { label: "充电方式", sourceLabel: "USB-C", getValue: (device) => firstAvailable(device, ["charging", "connector"]) },
      { label: "接口", getValue: (device) => device.port ?? firstAvailable(device, ["ports", "connector"]) },
    ],
  },
  {
    key: "protection",
    label: "🛡️ 防护与安全",
    sourceLabel: "防水等级 / 安全验证",
    description: "防水等级、安全验证和紧急安全能力。",
    specs: [
      { label: "防水等级", sourceLabel: "防溅、抗水、防尘", getValue: (device) => specText(device, "waterResistance") },
      { label: "安全验证", sourceLabel: "安全验证", getValue: (device) => specText(device, "security") },
    ],
  },
  {
    key: "connectivity",
    label: "📡 网络连接",
    sourceLabel: "无线网络 / 连接端口 / 蜂窝网络",
    description: "无线网络、蜂窝网络、接口和数据传输能力。",
    trendMetric: "port",
    specs: [
      { label: "连接端口", sourceLabel: "连接端口", getValue: (device) => device.port ?? firstAvailable(device, ["ports", "connector"]) },
      { label: "无线网络", sourceLabel: "无线网络", getValue: (device) => specText(device, "wireless") },
      { label: "蜂窝网络", sourceLabel: "蜂窝网络", getValue: (device) => specText(device, "cellular") },
      { label: "Apple Pencil", sourceLabel: "Apple Pencil", getValue: (device) => specText(device, "pencil") },
    ],
  },
];

// ==================== 笔记本功能分类配置 ====================
// 与手机保持一致的8个分类，包含笔记本特有规格
const laptopCategories: ComparisonCategory[] = [
  {
    key: "price",
    label: "💰 价格",
    sourceLabel: "首发价格 / 实时价格 / 二手价格",
    description: "设备的首发价格、当前实时价格和二手市场价格。",
    trendMetric: "price",
    specs: [
      { label: "首发价格", sourceLabel: "首发价格", getValue: (device) => formatMaybeCurrency(device.launchPrice) },
      { label: "实时价格", sourceLabel: "实时价格", getValue: (device) => specOptional(device, "currentPrice") || "—" },
      { label: "二手价格", sourceLabel: "二手价格", getValue: (device) => specOptional(device, "usedPrice") || "—" },
    ],
  },
  {
    key: "design",
    label: "📱 设计",
    sourceLabel: "外观 / 颜色 / 材料 / 尺寸",
    description: "外观设计、颜色、材料、尺寸和重量。",
    trendMetric: "weight",
    specs: [
      { label: "颜色", sourceLabel: "外观：颜色", getValue: (device) => specText(device, "colors") },
      { label: "材料", sourceLabel: "外观：材料", getValue: (device) => specText(device, "material") },
      { label: "重量", sourceLabel: "重量", getValue: (device) => specOptional(device, "weightNote") || weightValue(device) },
      { label: "屏幕尺寸", getValue: (device) => specOptional(device, "screenSizeNote") || (typeof device.screenSize === "number" ? `${device.screenSize} 英寸` : "—") },
      { label: "尺寸", sourceLabel: "尺寸与重量", getValue: (device) => specOptional(device, "dimensionsNote") || specText(device, "dimensions") },
    ],
  },
  {
    key: "display",
    label: "🖥️ 显示屏",
    sourceLabel: "屏幕尺寸 / 显示技术 / ProMotion / 涂层",
    description: "屏幕尺寸、显示类型、刷新率、ProMotion 和特殊涂层。",
    trendMetric: "screen",
    specs: [
      { label: "屏幕尺寸", sourceLabel: "显示屏：屏幕尺寸", getValue: (device) => specOptional(device, "screenSizeNote") || (typeof device.screenSize === "number" ? `${device.screenSize} 英寸` : "—") },
      { label: "显示类型", sourceLabel: "显示屏", getValue: (device) => specText(device, "displayType") },
      {
        label: "刷新率",
        sourceLabel: "显示屏：ProMotion",
        getValue: (device) => (device.refreshRate ? `${device.refreshRate}Hz` : pending),
      },
      { label: "ProMotion", getValue: (device) => (device.refreshRate && device.refreshRate >= 120 ? "支持" : "不支持") },
      { label: "显示涂层", sourceLabel: "显示屏：涂层 / 纳米纹理", getValue: (device) => specText(device, "displayCoating") },
    ],
  },
  {
    key: "chip_intelligence",
    label: "⚡ 芯片与智能",
    sourceLabel: "芯片 / CPU / GPU / 神经网络引擎 / 内存",
    description: "芯片性能、CPU/GPU 单元、神经网络引擎、内存和存储。",
    trendMetric: "chip",
    specs: [
      { label: "芯片", sourceLabel: "处理器：芯片", getValue: (device) => device.chip },
      { label: "中央处理器", sourceLabel: "处理器：中央处理器", getValue: (device) => specText(device, "cpu") },
      { label: "图形处理器", sourceLabel: "处理器：图形处理器", getValue: (device) => specText(device, "gpu") },
      { label: "神经网络引擎", sourceLabel: "处理器：引擎", getValue: (device) => specText(device, "neuralEngine") },
      { label: "内存", sourceLabel: "内存", getValue: (device) => specText(device, "memory") },
      { label: "存储容量", sourceLabel: "存储容量", getValue: (device) => specOptional(device, "storageNote") || specText(device, "storage") },
    ],
  },
  {
    key: "camera",
    label: "摄像头与音频",
    sourceLabel: "摄像头 / 麦克风 / 扬声器",
    description: "摄像头、麦克风和扬声器规格。",
    trendMetric: "camera",
    specs: [
      { label: "摄像头", sourceLabel: "摄像头", getValue: (device) => specText(device, "webcam") },
      { label: "麦克风", sourceLabel: "麦克风", getValue: (device) => specText(device, "microphone") },
      { label: "扬声器", sourceLabel: "扬声器", getValue: (device) => specText(device, "speakers") },
    ],
  },
  {
    key: "battery",
    label: "🔋 电池",
    sourceLabel: "电池续航 / 视频播放 / 充电方式",
    description: "电池续航、视频播放、充电方式和接口信息。",
    specs: [
      { label: "电池续航", sourceLabel: "电池", getValue: (device) => specOptional(device, "batteryNote") || specText(device, "battery") },
      { label: "视频播放", sourceLabel: "视频播放", getValue: (device) => specText(device, "videoPlayback") },
      { label: "无线上网", sourceLabel: "无线上网", getValue: (device) => specText(device, "webBrowsing") },
      { label: "充电方式", sourceLabel: "MagSafe / USB-C", getValue: (device) => firstAvailable(device, ["charging", "connector"]) },
    ],
  },
  {
    key: "protection",
    label: "🛡️ 防护与安全",
    sourceLabel: "Touch ID / 安全验证",
    description: "Touch ID、安全验证和紧急安全能力。",
    specs: [
      { label: "Touch ID", sourceLabel: "Touch ID", getValue: (device) => specText(device, "touchId") },
      { label: "安全验证", sourceLabel: "安全验证", getValue: (device) => specText(device, "security") },
    ],
  },
  {
    key: "connectivity",
    label: "📡 网络连接",
    sourceLabel: "无线网络 / 连接端口 / 蓝牙",
    description: "无线网络、接口和数据传输能力。",
    trendMetric: "port",
    specs: [
      { label: "连接端口", sourceLabel: "连接端口", getValue: (device) => device.port ?? firstAvailable(device, ["ports", "connector"]) },
      { label: "无线网络", sourceLabel: "无线网络", getValue: (device) => specText(device, "wireless") },
      { label: "蓝牙", sourceLabel: "蓝牙", getValue: (device) => specText(device, "bluetooth") },
      { label: "键盘", sourceLabel: "键盘", getValue: (device) => specText(device, "keyboard") },
      { label: "触控板", sourceLabel: "触控板", getValue: (device) => specText(device, "trackpad") },
    ],
  },
];

// ==================== 根据设备类别获取分类配置 ====================
const getComparisonCategories = (category: DeviceCategory): ComparisonCategory[] => {
  switch (category) {
    case "phone":
      return phoneCategories;
    case "tablet":
      return tabletCategories;
    case "laptop":
      return laptopCategories;
    default:
      return phoneCategories;
  }
};

// 对比范围选项：近3代、近4代、全部
const ranges: { key: RangeKey; label: string }[] = [
  { key: "recent3", label: "近 3 代" },
  { key: "all", label: "全部" },
];

// ==================== 主组件：DeviceWorkbench ====================
// 整个工作台的核心组件，包含所有状态管理和 UI 渲染
export default function DeviceWorkbench() {
  // ---- 状态定义 ----
  const defaultCategory = categoryNames[0] ?? "phone";
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory>(defaultCategory);  // 当前选中的产品类别（iPhone/iPad/MacBook）
  const availableSeries = useMemo(() => getSeriesByCategory(selectedCategory), [selectedCategory]);  // 根据类别计算可用的系列列表
  const [selectedSeries, setSelectedSeries] = useState(() => availableSeries[0] ?? "");  // 当前选中的系列（如 iPhone、iPhone Pro）
  const [range, setRange] = useState<RangeKey>("recent3");  // 对比范围：近3代/近4代/全部
  const [activeCategoryKey, setActiveCategoryKey] = useState<CategoryKey>("display");  // 当前选中的功能分类
  const [quickMetricKey, setQuickMetricKey] = useState<MetricKey>("chip");  // 折线图当前显示的指标
  const [analysisType, setAnalysisType] = useState<AnalysisType>("generation_summary");
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisOutput | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);

  // ---- 数据计算 ----
  // 获取当前系列的所有设备，按代际排序
  const seriesDevices = useMemo(
    () => getDevicesBySeries(selectedSeries),
    [selectedSeries],
  );

  // 根据对比范围筛选要显示的设备
  const comparisonDevices = useMemo(() => {
    if (range === "all") {
      return [...seriesDevices].reverse(); // 新机型在左
    }

    return seriesDevices.slice(Math.max(seriesDevices.length - 3, 0)).reverse(); // 新机型在左
  }, [range, seriesDevices]);

  // 获取当前选中的功能分类配置
  const comparisonCategories = useMemo(() => getComparisonCategories(selectedCategory), [selectedCategory]);
  const activeCategory =
    comparisonCategories.find((category) => category.key === activeCategoryKey) ??
    comparisonCategories[0];
  // 获取最新一代和上一代设备，用于计算变化
  const latestDevice = seriesDevices[seriesDevices.length - 1];
  const previousDevice = seriesDevices[seriesDevices.length - 2];
  // 计算最新两代之间发生变化的规格项
  const changedSpecs = useMemo(
    () => latestDevice
      ? activeCategory.specs.filter((spec) => {
        if (!previousDevice) {
          return false;
        }

        return spec.getValue(previousDevice) !== spec.getValue(latestDevice);
      })
      : [],
    [activeCategory, latestDevice, previousDevice],
  );

  const changedFields = useMemo(
    () => changedSpecs.map((spec) => ({
      label: spec.label,
      currentValue: latestDevice ? spec.getValue(latestDevice) : pending,
      previousValue: previousDevice ? spec.getValue(previousDevice) : pending,
    })),
    [changedSpecs, latestDevice, previousDevice],
  );

  useEffect(() => {
    if (!selectedSeries || seriesDevices.length === 0) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;
      setAiAnalysisLoading(true);
      setAiAnalysisError(null);
    });

    fetch("/api/ai-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        seriesName: selectedSeries,
        category: selectedCategory,
        analysisType,
        categoryLabel: activeCategory.label,
        devices: seriesDevices,
        latestDevice: latestDevice ?? null,
        previousDevice: previousDevice ?? null,
        changedFields,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(error?.error ?? "AI 分析请求失败");
        }

        return response.json() as Promise<AiAnalysisOutput>;
      })
      .then((result) => {
        if (!isActive) return;
        setAiAnalysis(result);
      })
      .catch((error) => {
        if (!isActive || error instanceof DOMException && error.name === "AbortError") return;
        setAiAnalysis(null);
        setAiAnalysisError(error instanceof Error ? error.message : "AI 分析请求失败");
      })
      .finally(() => {
        if (!isActive) return;
        setAiAnalysisLoading(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    activeCategory.label,
    analysisType,
    changedFields,
    latestDevice,
    previousDevice,
    selectedCategory,
    selectedSeries,
    seriesDevices,
  ]);

  // 切换产品类别时，自动选择该类别的第一个系列，并重置功能分类为第一个
  const handleCategoryChange = (category: DeviceCategory) => {
    const nextSeries = getSeriesByCategory(category)[0] ?? "";
    const nextCategories = getComparisonCategories(category);
    setSelectedCategory(category);
    setSelectedSeries(nextSeries);
    setActiveCategoryKey(nextCategories[0]?.key ?? "design");
  };

  const aiSourceLabel = aiAnalysisLoading
    ? "生成中"
    : aiAnalysis?.source === "ai"
      ? "AI API"
      : aiAnalysis?.source === "rules"
        ? "规则 fallback"
        : "待生成";
  const aiSummary = aiAnalysisLoading
    ? "正在根据当前系列和维度生成观察结论。"
    : aiAnalysis?.summary ?? "选择设备系列和对比维度后生成观察结论。";
  const aiPrediction = aiAnalysis?.prediction ?? "当前数据不足，暂无法给出趋势预测。";
  const aiBuyingAdvice = aiAnalysis?.buyingAdvice ?? "等待当前维度分析完成后再给出购买建议。";
  const aiConfidence = typeof aiAnalysis?.confidence === "number"
    ? `${Math.round(aiAnalysis.confidence * 100)}%`
    : "—";

  return (
    <main className="min-h-screen text-[#1E293B]">
      {/* 顶部横幅 */}
      <div className="border-b border-[#E8E4DC] bg-gradient-to-b from-[#FDFBF7] to-[#F5F4FB]">
        <div className="mx-auto w-full max-w-7xl px-3 py-4 md:px-8 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {/* 左侧：Logo + 标题 + 统计 */}
            <div className="shrink-0">
              <div className="flex items-center gap-4">
                {/* Logo */}
                <div className="relative">
                  <svg className="h-11 w-11" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6"/>
                        <stop offset="100%" stopColor="#06B6D4"/>
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="48" height="48" rx="12" fill="url(#logoBg)"/>
                    <path d="M 6 24 Q 6 14 24 14 Q 42 14 42 24 Q 42 34 24 34 Q 6 34 6 24 Z" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
                    <path d="M 9 24 Q 9 31 24 31 Q 39 31 39 24" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.3"/>
                    <rect x="17" y="18" width="14" height="12" rx="3" fill="#0B4F6C" opacity="0.85"/>
                    <rect x="17" y="18" width="14" height="12" rx="3" fill="none" stroke="#E0F2FE" strokeWidth="0.8" opacity="0.8"/>
                    <line x1="19" y1="24" x2="29" y2="24" stroke="#E0F2FE" strokeWidth="0.7" opacity="0.7"/>
                    <line x1="24" y1="19" x2="24" y2="29" stroke="#E0F2FE" strokeWidth="0.7" opacity="0.7"/>
                    <circle cx="24" cy="24" r="1.2" fill="#F6C76E"/>
                    <circle cx="22" cy="22" r="0.8" fill="#22C55E"/>
                    <circle cx="26" cy="22" r="0.8" fill="#F6C76E"/>
                    <circle cx="22" cy="26" r="0.8" fill="#F9A8D4"/>
                  </svg>
                  <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#22C55E] dot-live" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3B82F6]">DeviceScope</p>
                  <h1 className="gradient-title text-3xl font-bold md:text-5xl">数码观察站</h1>
                  <p className="mt-0.5 text-sm text-[#64748B]">数码产品代际对比 · AI 配置预测 · 设备推荐</p>
                </div>
              </div>
              {/* 统计卡片 */}
              <div className="mt-4 flex gap-3">
                <SummaryItem label="收录机型" value={String(summaryStats.modelCount)} />
                <SummaryItem label="覆盖年份" value={`${summaryStats.startYear}-${summaryStats.endYear}`} />
                <SummaryItem label="产品线" value={String(summaryStats.categoryCount)} />
              </div>
            </div>

            {/* 右侧：AI 观察摘要面板 */}
            <div className="flex shrink-0 flex-col gap-3 lg:w-[420px]">
              {/* 观察员头像 + 气泡 */}
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] text-lg shadow-[0_4px_12px_rgba(59,130,246,0.25)]">
                    🐣
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#22C55E] dot-live" />
                </div>
                <div className="relative rounded-2xl rounded-tl-md bg-[#FFFDF8] px-4 py-2.5 shadow-sm ring-1 ring-[#E8E4DC]">
                  {/* 气泡小三角 */}
                  <div className="absolute -left-1.5 top-3 h-3 w-3 rotate-45 bg-[#FFFDF8] border-l border-b border-[#E8E4DC]" />
                  <p className="text-xs font-semibold text-[#1E293B]">观察员小数</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
                    问我配置预测、设备推荐、代际差异
                  </p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium text-[#3B82F6] cursor-pointer hover:bg-[#3B82F6] hover:text-white transition">
                    💬 开始提问
                  </span>
                </div>
              </div>

              {/* AI 观察 — 紧凑单区块 */}
              <div className="rounded-xl bg-[#FFFDF8] px-4 py-3 shadow-sm ring-1 ring-[#E8E4DC]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">🔮 AI 观察</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    aiAnalysisLoading
                      ? "bg-[#FFF7ED] text-[#D97706]"
                      : aiAnalysis?.source === "ai"
                        ? "bg-[#EEF2FF] text-[#3B82F6]"
                        : "bg-[#F0FDF4] text-[#16A34A]"
                  }`}>
                    {aiSourceLabel}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="shrink-0 text-[#94A3B8]">分析模式</span>
                    <span className="font-semibold text-[#3B82F6]">
                      {analysisModes.find((mode) => mode.key === analysisType)?.label ?? "总结"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="shrink-0 text-[#94A3B8]">可信度</span>
                    <span className="font-semibold text-[#06B6D4]">{aiConfidence}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">摘要</span>
                    <p className="mt-0.5 line-clamp-2 font-semibold leading-relaxed text-[#1E293B]">{aiSummary}</p>
                  </div>
                </div>
                <p className="mt-2 border-t border-[#E8E4DC] pt-1.5 text-[10px] text-[#94A3B8]">
                  {aiAnalysis?.disclaimer ?? "AI 结论基于已收录数据生成，仅供参考"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="mx-auto w-full max-w-7xl px-3 py-4 md:px-8 lg:px-10">
        <section className="grid gap-5 lg:grid-cols-[248px_1fr]">
          {/* 统一侧边栏 */}
          <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <div className="card overflow-hidden">
              {/* 产品类别 */}
              <div className="border-b border-[#E8E4DC] px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">产品类别</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {categoryNames.map((category) => (
                    <button
                      className={`rounded-lg py-2 text-xs font-medium transition ${
                        selectedCategory === category
                          ? "bg-[#3B82F6] text-white glow-active"
                          : "bg-[#F5F0E8] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#3B82F6]"
                      }`}
                      key={category}
                      type="button"
                      onClick={() => handleCategoryChange(category)}
                    >
                      {categoryLabels[category]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 机型系列 */}
              <div className="border-b border-[#E8E4DC] px-4 py-3.5">
                <label className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]" htmlFor="series">机型系列</label>
                <select
                  className="mt-2 h-9 w-full rounded-lg border border-[#E8E4DC] bg-[#F5F0E8] px-2.5 text-xs font-semibold text-[#1E293B] outline-none transition focus:border-[#3B82F6]"
                  id="series"
                  value={selectedSeries}
                  onChange={(e) => setSelectedSeries(e.target.value)}
                >
                  {availableSeries.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>

              {/* 功能分类 */}
              <div className="border-b border-[#E8E4DC] px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">功能分类</p>
                <div className="mt-1.5 space-y-0.5">
                  {comparisonCategories.map((cat) => (
                    <button
                      className={`w-full rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition ${
                        activeCategoryKey === cat.key ? "bg-[#EEF2FF] text-[#3B82F6]" : "text-[#64748B] hover:bg-[#F5F0E8]"
                      }`}
                      key={cat.key}
                      type="button"
                      onClick={() => setActiveCategoryKey(cat.key)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 对比范围 */}
              <div className="border-b border-[#E8E4DC] px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">对比范围</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {ranges.map((item) => (
                    <button
                      className={`rounded-lg py-1.5 text-xs font-medium transition ${
                        range === item.key ? "bg-[#3B82F6] text-white shadow-sm" : "bg-[#F5F0E8] text-[#64748B] hover:bg-[#EEF2FF]"
                      }`}
                      key={item.key}
                      type="button"
                      onClick={() => setRange(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 当前分析状态 */}
              <div className="px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">分析状态</p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#64748B]">当前系列</span>
                    <span className="font-medium text-[#1E293B]">{selectedSeries}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#64748B]">跟踪代际</span>
                    <span className="font-medium text-[#3B82F6]">{seriesDevices.length} 代</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#64748B]">最新变化</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${changedSpecs.length > 2 ? "bg-[#FDF2F8] text-[#EC4899]" : "bg-[#F0FDF0] text-[#22C55E]"}`}>
                      {changedSpecs.length > 0 ? `${changedSpecs.length} 项` : "无"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-[#FFF7ED] p-2 text-center text-[10px] text-[#F6C76E]">
                  ⚡ AI 分析就绪
                </div>
              </div>

              {/* 当前分类字段数 */}
              <div className="border-t border-[#E8E4DC] px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">当前分类</p>
                <p className="mt-1.5 text-[11px] text-[#64748B]">
                  <span className="font-medium text-[#1E293B]">{activeCategory.specs.length}</span> 个对比项
                </p>
              </div>

              {/* 当前系列设备列表 */}
              <div className="border-t border-[#E8E4DC] px-4 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#94A3B8]">系列设备</p>
                <div className="mt-2 space-y-1">
                  {seriesDevices.map((device) => (
                    <p key={device.id} className="text-[11px] text-[#64748B]">
                      <span className="font-medium text-[#1E293B]">{device.model}</span>
                      <span className="ml-1 text-[#94A3B8]">· {device.releaseYear}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* 右侧：仅两个大模块 */}
          <div className="min-w-0 space-y-3">
            {/* 趋势对比（含 AI 观察摘要 + 关键变化） */}
            <section className="card overflow-hidden">
              {/* 标题栏 */}
              <div className="flex flex-col gap-1.5 border-b border-[#E8E4DC] p-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1E293B]">趋势对比</p>
                    <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium text-[#3B82F6]">实时</span>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-[#1E293B]">{selectedSeries} · {activeCategory.label}</h2>
                </div>
                <span className="text-xs text-[#94A3B8]">{seriesDevices[0]?.releaseYear} → {latestDevice?.releaseYear}</span>
              </div>

              {/* 描述 + 指标 */}
              <div className="px-5 pt-4">
                <p className="text-sm leading-6 text-[#64748B]">{activeCategory.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {quickMetrics.map((metric) => (
                    <button
                      key={metric.key}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        quickMetricKey === metric.key ? "bg-[#3B82F6] text-white shadow-sm" : "bg-[#F5F0E8] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#3B82F6]"
                      }`}
                      type="button"
                      onClick={() => setQuickMetricKey(metric.key)}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>


              {/* 折线图（全宽） */}
              <div className="mt-4 min-w-0 overflow-x-auto px-3 pb-5 lg:px-5">
                <TrendChart devices={seriesDevices} metric={metricByKey(quickMetricKey)} />
              </div>

              {/* 关键变化 — 折线图下方横向列表 */}
              <div className="overflow-x-auto border-t border-[#E8E4DC] bg-[#F8FAFE] px-3 py-4 lg:px-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">关键变化</p>
                {changedSpecs.slice(0, 5).length === 0 ? (
                  <p className="mt-2 text-[11px] text-[#94A3B8]">暂无变化</p>
                ) : (
                  <div className="mt-3 flex flex-nowrap gap-4 lg:flex-wrap">
                    {changedSpecs.slice(0, 5).map((spec, i) => (
                      <div key={i} className="min-w-[140px] shrink-0 lg:shrink">
                        <p className="text-[10px] text-[#94A3B8]">{spec.label}</p>
                        <p className="mt-0.5 text-xs font-semibold text-[#1E293B]">{latestDevice ? spec.getValue(latestDevice) : "—"}</p>
                        <p className="text-[10px] text-[#3B82F6]">{previousDevice ? `← ${spec.getValue(previousDevice)}` : ""}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* AI 分析 */}
            <section className="card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-[#E8E4DC] p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1E293B]">AI 分析</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      aiAnalysisLoading
                        ? "bg-[#FFF7ED] text-[#D97706]"
                        : aiAnalysis?.source === "ai"
                          ? "bg-[#EEF2FF] text-[#3B82F6]"
                          : "bg-[#F0FDF4] text-[#16A34A]"
                    }`}>
                      {aiSourceLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#94A3B8]">{selectedSeries} · {activeCategory.label}</p>
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#F5F0E8] p-1">
                  {analysisModes.map((mode) => (
                    <button
                      key={mode.key}
                      className={`h-8 rounded-md px-2 text-xs font-medium transition ${
                        analysisType === mode.key
                          ? "bg-white text-[#3B82F6] shadow-sm"
                          : "text-[#64748B] hover:text-[#1E293B]"
                      }`}
                      type="button"
                      onClick={() => setAnalysisType(mode.key)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 p-5 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">观察摘要</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#1E293B]">{aiSummary}</p>
                  {aiAnalysisError && (
                    <p className="mt-2 rounded-lg bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">{aiAnalysisError}</p>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">事实依据</p>
                      <div className="mt-2 space-y-1.5">
                        {(aiAnalysis?.facts.length ? aiAnalysis.facts : ["等待 AI 分析返回结构化事实。"]).map((fact, index) => (
                          <p key={`${fact}-${index}`} className="text-xs leading-relaxed text-[#64748B]">
                            <span className="mr-1 font-semibold text-[#3B82F6]">{index + 1}.</span>{fact}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">观察洞察</p>
                      <div className="mt-2 space-y-1.5">
                        {(aiAnalysis?.insights.length ? aiAnalysis.insights : ["正在把事实转换为观察结论。"]).map((insight, index) => (
                          <p key={`${insight}-${index}`} className="text-xs leading-relaxed text-[#64748B]">
                            <span className="mr-1 font-semibold text-[#06B6D4]">{index + 1}.</span>{insight}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">趋势预测</p>
                    <p className="mt-2 text-xs leading-relaxed text-[#64748B]">{aiPrediction}</p>
                  </div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">购买建议</p>
                  <p className="text-xs leading-relaxed text-[#64748B]">{aiBuyingAdvice}</p>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">缺失数据</p>
                    {aiAnalysis?.missingData.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {aiAnalysis.missingData.map((item) => (
                          <span key={item} className="rounded-full bg-[#F5F0E8] px-2 py-1 text-[11px] text-[#64748B]">{item}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[#94A3B8]">暂无缺失数据提示。</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#E8E4DC] px-5 py-2.5">
                <p className="text-[10px] text-[#94A3B8]">{aiAnalysis?.disclaimer ?? "AI 分析基于已收录设备的结构化数据生成，结论仅供参考。"}</p>
              </div>
            </section>

            {/* 详细对比 */}
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] p-5">
                <div>
                  <p className="text-sm font-semibold text-[#1E293B]">详细对比</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#1E293B]">{activeCategory.label}</h2>
                </div>
              </div>
              <ComparisonMatrix category={activeCategory} devices={comparisonDevices} />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

// ==================== 辅助组件 ====================

// 顶部统计卡片组件（显示机型数、年份范围、产品线数）
function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-5 py-3 text-center shadow-sm ring-1 ring-[#E8E4DC]">
      <p className="gradient-title text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] text-[#94a3b8]">{label}</p>
    </div>
  );
}

// ==================== 折线图组件 ====================
// 使用 SVG 绘制平滑曲线，支持 Y 轴刻度和数据标签
function TrendChart({
  devices,
  metric,
}: {
  devices: Device[];
  metric: MetricConfig;
}) {
  // 过滤出有数值的设备，用于绘制折线图
  const numericPoints = devices
    .map((device) => ({ device, value: metric.getChartValue(device) }))
    .filter((point): point is { device: Device; value: number } => typeof point.value === "number");

  // 如果没有可绘制的数值，显示空状态提示
  if (numericPoints.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-[#E8E4DC] bg-[#F3EEFC] p-8 text-center text-sm text-[#94a3b8]">
        该系列缺少可绘制的 {metric.label} 数值。
      </div>
    );
  }

  // ---- 计算 Y 轴范围 ----
  const values = numericPoints.map((point) => point.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  // AI 能力固定 0-10 范围，其他指标取数据范围的 90%-110%
  const yMin = metric.key === "ai" ? 0 : Math.floor(dataMin * 0.9);
  const yMax = metric.key === "ai" ? 10 : Math.ceil(dataMax * 1.1);
  const yRange = yMax - yMin || 1;
  
  // 图表内边距配置
  const padding = { left: 12, right: 8, top: 12, bottom: 10 };
  const chartWidth = 100 - padding.left - padding.right;
  const chartHeight = 65 - padding.top - padding.bottom;
  
  // ---- 计算每个数据点的 SVG 坐标 ----
  const points = numericPoints.map((point, index) => {
    // X 坐标：均匀分布
    const x = numericPoints.length === 1 
      ? padding.left + chartWidth / 2 
      : padding.left + (index / (numericPoints.length - 1)) * chartWidth;
    // Y 坐标：根据数值映射到图表高度（SVG Y轴向下，所以要反转）
    const y = padding.top + chartHeight - ((point.value - yMin) / yRange) * chartHeight;
    return { ...point, x, y };
  });

  // ---- 生成平滑曲线路径 ----
  // 使用贝塞尔曲线让折线更平滑美观
  const createSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;  // 控制点在两个点中间
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  const smoothPath = createSmoothPath(points);

  // ---- 生成 Y 轴刻度 ----
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) => {
    return yMin + (yRange * i) / (yTicks - 1);
  });

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="min-w-[700px]">
        <svg
          aria-label={`${metric.label}趋势图`}
          className="h-[320px] w-full"
          viewBox="0 0 100 80"
        >
          <line
            stroke="#334155"
            strokeDasharray="2 2"
            strokeWidth="0.1"
            x1={padding.left}
            x2={padding.left + chartWidth}
            y1={padding.top + chartHeight}
            y2={padding.top + chartHeight}
          />

          {yTickValues.map((tickValue, i) => {
            const y = padding.top + chartHeight - (i / (yTicks - 1)) * chartHeight;
            const displayTick = metric.key === "price"
              ? formatCompactCurrency(tickValue)
              : metric.key === "ai"
                ? `${Math.round(tickValue)}/10`
                : metric.key === "screen"
                  ? tickValue.toFixed(1)
                  : Math.round(tickValue).toString();
            return (
              <g key={`tick-${i}`}>
                <line
                  stroke="#1e293b"
                  strokeWidth="0.08"
                  x1={padding.left}
                  x2={padding.left + chartWidth}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="#64748b"
                  fontSize="2"
                  textAnchor="end"
                  x={padding.left - 1.5}
                  y={y + 0.6}
                >
                  {displayTick}
                </text>
              </g>
            );
          })}
          
          <path
            fill="none"
            d={smoothPath}
            stroke="#2563eb"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
          
          {points.map((point, index) => {
            const isLast = index === points.length - 1;
            const displayValue = metric.key === "price"
              ? formatCompactCurrency(point.value)
              : metric.key === "ai"
                ? `${Math.round(point.value)}/10`
                : metric.key === "screen"
                  ? `${point.value}`
                  : metric.getValue(point.device);
            return (
              <g key={point.device.id}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  fill={isLast ? "#2563eb" : "#ffffff"}
                  r={isLast ? "1.2" : "0.8"}
                  stroke="#2563eb"
                  strokeWidth={isLast ? "0" : "0.25"}
                />
                <text
                  fill="#64748b"
                  fontSize="2.2"
                  textAnchor="middle"
                  x={point.x}
                  y={padding.top + chartHeight + 6}
                >
                  {point.device.releaseYear}
                </text>
                {isLast ? (
                  <g>
                    <rect
                      x={point.x - 11}
                      y={point.y - 8}
                      width="22"
                      height="5.5"
                      rx="1"
                      fill="#2563eb"
                    />
                    <text
                      fill="#ffffff"
                      fontSize="2.2"
                      fontWeight="600"
                      textAnchor="middle"
                      x={point.x}
                      y={point.y - 4.2}
                    >
                      {displayValue}
                    </text>
                  </g>
                ) : (
                  <text
                    fill="#64748b"
                    fontSize="2"
                    textAnchor="middle"
                    x={point.x}
                    y={point.y - 3}
                  >
                    {displayValue}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {metric.key === "chip" && (
        <p className="mt-2 text-center text-[10px] text-[#94a3b8]">
          * 芯片趋势使用内部性能指数，仅用于代际变化展示
        </p>
      )}
    </div>
  );
}

// ==================== 详细对比表格组件 ====================
// 显示多个设备的规格对比，最新一代有升级的项目用蓝色高亮
function ComparisonMatrix({
  category,
  devices,
}: {
  category: ComparisonCategory;
  devices: Device[];
}) {
  // 计算每列最小宽度：3列时不需要滑动，超过3列时需要滑动
  const columnCount = devices.length;
  const columnMinWidth = columnCount <= 3 ? "min-w-[200px]" : "min-w-[220px]";
  const tableMinWidth = columnCount <= 3 ? "100%" : `${180 + columnCount * 220}px`;

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm" style={{ minWidth: tableMinWidth, width: "100%" }}>
        <thead>
          <tr className="border-b border-[#F5F0E8] bg-[#fafbfd]">
            <th className="w-48 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.15em] text-[#94a3b8]">
              {category.sourceLabel}
            </th>
            {devices.map((device) => (
              <th
                className={`${columnMinWidth} px-5 py-3 text-left text-sm font-semibold text-[#1e293b]`}
                key={device.id}
              >
                <span>{device.model}</span>
                <span className="mt-1 block text-xs font-medium text-[#64748b]">
                  {device.releaseYear}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {category.specs.map((spec) => {
            // 获取每个设备在该规格项的值（新机型在左，index=0是最新）
            const values = devices.map(spec.getValue);
            const newValue = values[0];      // 最新一代的值（左边第一列）
            const prevValue = values.length >= 2 ? values[1] : undefined;  // 上一代的值（左边第二列）
            // 判断最新一代是否有升级（值不同且不是"—"）
            const hasUpgrade = newValue !== pending && prevValue !== pending && newValue !== prevValue;

            return (
              <tr className="border-b border-[#F5F0E8] transition-colors hover:bg-[#F3EEFC] last:border-b-0" key={spec.label}>
                <td className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-[#1e293b]">{spec.label}</p>
                  {spec.sourceLabel ? (
                    <p className="mt-0.5 text-[11px] text-[#94a3b8]">{spec.sourceLabel}</p>
                  ) : null}
                </td>
                {devices.map((device, index) => {
                  const value = spec.getValue(device);
                  const isPending = value === pending;
                  const isFirst = index === 0;
                  const isChanged = isFirst && hasUpgrade;

                  return (
                    <td className="px-5 py-3.5 align-top" key={device.id}>
                      <span
                        className={`text-sm ${
                          isPending
                            ? "text-slate-400"
                            : isChanged
                              ? "font-semibold text-slate-900"
                              : "text-slate-600"
                        }`}
                      >
                        {value}
                        {isChanged && !isPending && (
                          <span className="ml-1.5 text-[10px] font-normal text-slate-400">↑</span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
