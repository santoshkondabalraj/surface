import { NextResponse } from "next/server";
import { getMCPClient, resetMCPClient } from "@/lib/mcp-client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uri = searchParams.get("uri");

  try {
    const mcp = await getMCPClient();

    if (uri) {
      const result = await mcp.readResource({ uri });
      return NextResponse.json(result);
    }

    const { resources } = await mcp.listResources();
    return NextResponse.json(resources);
  } catch (err) {
    await resetMCPClient();
    const message = err instanceof Error ? err.message : "MCP server unavailable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
