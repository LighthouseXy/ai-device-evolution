import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DeviceAdvisorEvalDashboard from "@/components/DeviceAdvisorEvalDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "device-advisor AI eval 看板",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeviceAdvisorEvalPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DeviceAdvisorEvalDashboard />;
}
