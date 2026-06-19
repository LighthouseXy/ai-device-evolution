# 数码观察站 - DeviceScope

## 项目介绍
基于多品牌手机/平板/笔记本历代配置数据，分析产品代际升级规律，并预测下一代可能升级方向。

## 核心功能
- 产品配置数据库（支持 iPhone、iPad、MacBook，后续扩展更多品牌）
- 代际差异对比（多维度规格表格 + 趋势折线图）
- 升级频率统计（各指标升级周期与幅度分析）
- 下一代配置预测（规则预测模型 + 置信度评估）
- AI 趋势报告生成（大模型驱动的自然语言分析报告）

## 技术栈
Next.js 16 / React 19 / Tailwind CSS 4 / SVG Charts / 大模型 API

## 核心设计
规则预测模型 + AI 报告生成

## 项目结构
```
src/
├── app/                # Next.js App Router
├── components/         # UI 组件
│   └── DeviceWorkbench.tsx  # 核心工作台组件
├── lib/                # 工具函数
│   └── devices.ts      # 数据处理与查询
└── data/               # 数据源
    └── devices.json    # 设备配置数据
```

## 项目截图
...

## 后续规划
- 支持更多品牌（Samsung、Xiaomi、Huawei 等）
- 接入价格数据（历史价格、二手行情）
- 微信小程序版本
- 引入真实数据库（PostgreSQL / MongoDB）
- 用户收藏与对比功能
