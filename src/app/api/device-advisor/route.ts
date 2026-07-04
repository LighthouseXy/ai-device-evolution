import { NextResponse } from "next/server";
import {
  fallbackDeviceAdvisorAfterAiError,
  fetchAiDeviceAdvisor,
  resolveDeviceAdvisorProvider,
} from "@/lib/device-advisor-ai";
import {
  normalizeDeviceAdvisorInput,
  runFallbackDeviceAdvisor,
} from "@/lib/device-advisor";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须为合法 JSON" }, { status: 400 });
  }

  const input = normalizeDeviceAdvisorInput(body);
  if (!input) {
    return NextResponse.json(
      {
        error:
          "缺少必要字段或字段格式不正确：budget, category, performancePreference, useCases, intent, replacementIntent, maxResults",
      },
      { status: 400 },
    );
  }

  const provider = resolveDeviceAdvisorProvider();
  if (!provider) {
    return NextResponse.json(runFallbackDeviceAdvisor(input));
  }

  try {
    return NextResponse.json(await fetchAiDeviceAdvisor(provider, input));
  } catch (error) {
    console.error("Device advisor failed, using fallback:", error);
    return NextResponse.json(fallbackDeviceAdvisorAfterAiError(provider, input, error));
  }
}
