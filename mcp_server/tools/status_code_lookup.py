"""Status Code Lookup Tool - Get numeric status codes from KG."""

import logging
from typing import Dict, Any
from mcp.server.mcpserver import MCPServer
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from kg_layer import Neo4JClient

logger = logging.getLogger(__name__)


def register_status_code_lookup_tool(mcp: FastMCP):
    """Register status code lookup tool for API queries."""

    @mcp.tool()
    def lookup_status_code(status_name: str) -> Dict[str, Any]:
        """
        Look up the numeric status code for a given status name/description.

        REQUIRED before building API XML queries. The API expects numeric status codes (e.g., '3350'),
        NOT status descriptions (e.g., 'Included In Shipment').

        Args:
            status_name: The status name or description (e.g., "Included In Shipment", "Scheduled", "Shipped")

        Returns:
            Dictionary with status_code, status_name, and whether lookup was successful
        """
        try:
            client = Neo4JClient()

            # Query for the status code
            cypher = """
            MATCH (sc:StatusCode)
            WHERE sc.name CONTAINS $status_name OR sc.description CONTAINS $status_name
            RETURN sc.code, sc.name, sc.description, sc.process_type
            LIMIT 5
            """

            results = client.run_query(cypher, {"status_name": status_name})
            client.close()

            if not results:
                return {
                    "success": False,
                    "status_name": status_name,
                    "status_code": None,
                    "error": f"Status '{status_name}' not found in Knowledge Graph",
                    "message": "This means the API will return 0 results if you pass the description instead of the code."
                }

            # Return the first result
            result = results[0]
            status_code = result.get("sc.code")
            name = result.get("sc.name")
            description = result.get("sc.description")
            process_type = result.get("sc.process_type")

            return {
                "success": True,
                "status_name": status_name,
                "status_code": status_code,
                "found_as": {
                    "name": name,
                    "description": description,
                    "process_type": process_type
                },
                "usage_instruction": f"Use Status=\"{status_code}\" in your API XML, NOT Status=\"{status_name}\"",
                "xml_example": f"<Order StatusQryType=\"EQ\" Status=\"{status_code}\"/>"
            }

        except Exception as e:
            logger.error(f"[Status Lookup] Failed: {e}")
            return {
                "success": False,
                "status_name": status_name,
                "status_code": None,
                "error": str(e)
            }

    logger.info("[Status Code Lookup] Tool registered: lookup_status_code")
