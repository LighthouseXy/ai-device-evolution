import type { Metadata } from "next";
import "./globals.css";

// 页面元信息会显示在浏览器标签和搜索摘要中，后续打磨项目时可以继续补充。
export const metadata: Metadata = {
  title: "数码观察站 - DeviceScope",
  description: "多品牌数码设备规格对比、代际演进分析与下一代配置预测",
  icons: { icon: "/icon.svg" },
};

// App Router 的根布局，所有页面都会被包在这个 html/body 结构里。
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
