import { getMCPClient } from "@/lib/mcp-client";

export const maxDuration = 60; // Health check should be fast

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Try to connect to MCP server
    getMCPClient();

    // If we get here, MCP client is available
    return Response.json({
      status: "healthy",
      timestamp,
      services: {
        frontend: "ok",
        mcp: "ok"
      },
      version: "1.0.0"
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({
      status: "degraded",
      timestamp,
      services: {
        frontend: "ok",
        mcp: "unavailable"
      },
      error: errorMsg,
      version: "1.0.0"
    }, { status: 503 });
  }
}
