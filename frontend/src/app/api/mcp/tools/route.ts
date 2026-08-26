import { NextResponse } from "next/server";
import { getMCPClient, resetMCPClient } from "@/lib/mcp-client";

export async function GET() {
  try {
    const mcp = await getMCPClient();
    const { tools } = await mcp.listTools();
    return NextResponse.json(tools);
  } catch (err) {
    await resetMCPClient();
    const message = err instanceof Error ? err.message : "MCP server unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
