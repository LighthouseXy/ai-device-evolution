import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteNav from "@/components/layout/SiteNav";

export const metadata: Metadata = {
  title: "数码观察站｜电子设备代际演进分析平台",
  description: "聚焦电子设备代际演进、规格对比与 AI 辅助分析，Apple 仅作为第一阶段样本范围。",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <div className="site-shell">
          <SiteNav />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
