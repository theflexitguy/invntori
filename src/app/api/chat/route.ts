import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages, system } = await req.json() as {
    messages: Array<{ role: string; content: string }>;
    system: string;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      stream: true,
      system,
      messages,
    }),
  });

  if (!anthropicRes.ok) {
    const text = await anthropicRes.text();
    return NextResponse.json({ error: text }, { status: anthropicRes.status });
  }

  return new Response(anthropicRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
