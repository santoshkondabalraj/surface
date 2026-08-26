"""Orbiter MCP Server — exposes tools, resources, and prompts via SSE."""
import os
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Load .env BEFORE importing tools that use environment variables
env_path = Path(__file__).parent.parent / 'frontend' / '.env'
load_dotenv(dotenv_path=env_path)

import sys
import io
from mcp.server.mcpserver import MCPServer

# Flush stdout to ensure KG message prints immediately
sys.stdout.flush()

# ============================================================================
# KNOWLEDGE GRAPH INITIALIZATION (Optional)
# KG provides semantic data for 4 tools; graceful fallback if unavailable
# See KG_DEPENDENCY_MAP.md for which tools depend on KG
# ============================================================================

import datetime
KG_AVAILABLE = False
KG_STATUS = {}

try:
    from kg_layer import initialize_kg
    kg_success, kg_message = initialize_kg(force_reset=False)
    if kg_success:
        print(f"[KG] OK {kg_message}", flush=True)
        KG_AVAILABLE = True
        KG_STATUS = {"available": True, "message": kg_message, "timestamp": datetime.datetime.now().isoformat()}
    else:
        print(f"[KG] DEGRADED {kg_message}", flush=True)
        print(f"[KG]   Tools that depend on KG will fail gracefully", flush=True)
        print(f"[KG]   Core functionality (SQL, skills) unaffected", flush=True)
        KG_AVAILABLE = False
        KG_STATUS = {"available": False, "message": kg_message, "timestamp": datetime.datetime.now().isoformat()}
except ImportError as e:
    print(f"[KG] UNAVAILABLE Knowledge Graph module not available: {str(e)}", flush=True)
    print(f"[KG]   Tools that depend on KG will fail gracefully", flush=True)
    KG_AVAILABLE = False
    KG_STATUS = {"available": False, "message": f"Import error: {str(e)}", "timestamp": datetime.datetime.now().isoformat()}
except Exception as e:
    print(f"[KG] UNAVAILABLE Knowledge Graph initialization failed: {str(e)}", flush=True)
    print(f"[KG]   Tools that depend on KG will fail gracefully", flush=True)
    KG_AVAILABLE = False
    KG_STATUS = {"available": False, "message": f"Initialization error: {str(e)}", "timestamp": datetime.datetime.now().isoformat()}

sys.stdout.flush()

# ============================================================================
# CORE Q&A TOOLS (9 active tools registered below)
# See mcp_server/TOOL_REGISTRY.md for full registry
# Deprecated tools have been moved to tools/deprecated/ (see tools/deprecated/README.md)
# ============================================================================

from tools.skill_retrieval import register_skill_retrieval_tool
from tools.kg_query import register_kg_query_tool
from tools.kg_relationships import register_kg_relationships_tool
from tools.sterling_columns import register_sterling_columns_tool
from tools.sterling import register_sterling_tools
from tools.exceptions import register_exception_tools
from tools.status_code_lookup import register_status_code_lookup_tool
from tools.execute_sql_query import register_execute_sql_query_tool
from tools.api_schema_tools import register_api_schema_tools

# Prompts
from prompts.sterling_sf_prompts import register_sterling_sf_prompts
from prompts.oms_prompts import register_oms_prompts
from prompts.general_query_prompt import register_general_query_prompts

# Resources
from resources.schemas import register_schema_resources

mcp = MCPServer("Orbiter")

# ============================================================================
# TOOL REGISTRATION (9 active tools - see TOOL_REGISTRY.md)
# ============================================================================

register_skill_retrieval_tool(mcp)
register_kg_query_tool(mcp)
register_kg_relationships_tool(mcp)
register_sterling_columns_tool(mcp)
register_sterling_tools(mcp)
register_exception_tools(mcp)
register_status_code_lookup_tool(mcp)
register_execute_sql_query_tool(mcp)
register_api_schema_tools(mcp)

# Register prompts
register_sterling_sf_prompts(mcp)
register_oms_prompts(mcp)
register_general_query_prompts(mcp)

# Register resources
register_schema_resources(mcp)

# ASGI app with /sse (GET) and /messages (POST) endpoints
app = mcp.sse_app()

# Debug: list all registered tools
print("\n[MCP] All registered tools:")
if hasattr(mcp._tool_manager, '_tools'):
    for tool_name in mcp._tool_manager._tools.keys():
        print(f"  - {tool_name}")
else:
    print("  (No _tools found)")

if __name__ == "__main__":
    host = os.getenv("MCP_HOST", "0.0.0.0")
    port = int(os.getenv("MCP_PORT", "8001"))
    print(f"\nStarting Orbiter MCP server on http://{host}:{port}")
    print("  SSE endpoint:      GET  /sse")
    print("  Messages endpoint: POST /messages")
    uvicorn.run(app, host=host, port=port, log_level="info")
