import { NextResponse } from "next/server";
import { getMCPClient, resetMCPClient } from "@/lib/mcp-client";

export async function GET() {
  try {
    const mcp = await getMCPClient();
    const { prompts } = await mcp.listPrompts();
    return NextResponse.json(prompts);
  } catch (err) {
    await resetMCPClient();
    const message = err instanceof Error ? err.message : "MCP server unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const body = await req.json() as { name: string; arguments?: Record<string, string> };

  try {
    const mcp = await getMCPClient();
    const result = await mcp.getPrompt({ name: body.name, arguments: body.arguments });
    // Return the text of the first message
    const text = result.messages
      .map((m) => (typeof m.content === "string" ? m.content : (m.content as { text: string }).text))
      .join("\n");
    return NextResponse.json({ text });
  } catch (err) {
    await resetMCPClient();
    const message = err instanceof Error ? err.message : "MCP server unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
