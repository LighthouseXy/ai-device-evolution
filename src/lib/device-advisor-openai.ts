import {
  buildDeviceAdvisorPrompt,
  deviceAdvisorOutputSchema,
  groundDeviceAdvisorOutput,
  normalizeDeviceAdvisorOutput,
  runFallbackDeviceAdvisor,
  type DeviceAdvisorInput,
  type DeviceAdvisorOutput,
} from "@/lib/device-advisor";

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      output_text?: string;
    }>;
  }>;
};

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_DISCLAIMER = "基于已收录设备数据生成，仅供参考";
const OPENAI_TIMEOUT_MS = 15_000;

function extractOpenAIText(data: OpenAIResponsesPayload): string {
  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const parts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const entry of content) {
      const text = typeof entry.text === "string" ? entry.text : entry.output_text;
      if (typeof text === "string" && text.trim().length > 0) {
        parts.push(text);
      }
    }
  }

  return parts.join("\n").trim();
}

export async function fetchOpenAIAdvisor(input: DeviceAdvisorInput): Promise<DeviceAdvisorOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return runFallbackDeviceAdvisor(input);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      instructions: [
        "You are DeviceScope, a careful Apple device advisor.",
        "Respond with a single valid JSON object only.",
        "Do not use markdown code fences or any extra prose.",
        "Only recommend devices from the provided candidate list.",
        "Do not invent missing prices, specs, or unsupported claims.",
      ].join(" "),
      input: buildDeviceAdvisorPrompt(input),
      temperature: 0.2,
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          name: "device_advisor_output",
          strict: true,
          schema: deviceAdvisorOutputSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  let payload: OpenAIResponsesPayload;
  try {
    payload = (await response.json()) as OpenAIResponsesPayload;
  } catch {
    throw new Error("OpenAI response was not valid JSON");
  }

  const rawText = extractOpenAIText(payload);
  if (!rawText) {
    throw new Error("OpenAI response did not include text output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("OpenAI response text was not valid JSON");
  }

  const normalized = normalizeDeviceAdvisorOutput(parsed);
  const grounded = normalized ? groundDeviceAdvisorOutput(input, normalized) : null;
  if (!grounded) {
    throw new Error("OpenAI response JSON was missing required fields");
  }

  return {
    ...grounded,
    source: "ai",
    disclaimer: DEFAULT_DISCLAIMER,
  };
}
