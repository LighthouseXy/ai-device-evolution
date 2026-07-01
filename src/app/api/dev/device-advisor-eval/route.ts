import { NextResponse } from "next/server";
import { readDeviceAdvisorEvalBundle } from "@/lib/device-advisor-eval";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const requestedFile = url.searchParams.get("file");
  const bundle = await readDeviceAdvisorEvalBundle(requestedFile);

  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

