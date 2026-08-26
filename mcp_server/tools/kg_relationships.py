"""Knowledge Graph Relationships Tool - Get exact foreign keys between tables."""

import logging
from typing import List, Dict, Any
from mcp.server.mcpserver import MCPServer
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from kg_layer import Neo4JClient

logger = logging.getLogger(__name__)


def register_kg_relationships_tool(mcp: FastMCP):
    """Register KG relationships tool for querying table joins."""

    @mcp.tool()
    def get_table_relationships(table_name: str) -> Dict[str, Any]:
        """
        Get all foreign key relationships for a table in the Knowledge Graph.

        This tool returns the exact columns and target tables needed to JOIN this table
        with other tables. No Cypher query needed - just provide the table name.

        Args:
            table_name: The table to query (e.g., "YFS_SHIPMENT_CONTAINER")

        Returns:
            List of relationships with exact column names, cardinality, and descriptions
        """
        try:
            client = Neo4JClient()

            # Query: get all foreign key relationships from this table with column descriptions
            table_name_clean = table_name.replace("TABLE:", "")

            cypher = """
            MATCH (source:TABLE {name: $table_name})
              -[r:REFERENCES]->(target:TABLE)
            OPTIONAL MATCH (fk_col:COLUMN {name: r.via_column, table: source.name})
            RETURN {
                source_table: source.name,
                fk_column: r.via_column,
                fk_description: fk_col.description,
                target_table: target.name,
                column_info: r.via_column,
                confidence: r.confidence
            } as relationship
            ORDER BY target.name
            """

            results = client.run_query(cypher, {"table_name": table_name_clean})
            client.close()

            if not results:
                return {
                    "success": False,
                    "table_name": table_name,
                    "error": f"Table '{table_name}' not found in Knowledge Graph",
                    "relationships": []
                }

            relationships = [r.get("relationship") for r in results]

            return {
                "success": True,
                "table_name": table_name,
                "relationship_count": len(relationships),
                "relationships": relationships
            }
        except Exception as e:
            logger.error(f"[KG Relationships] Failed: {e}")
            return {
                "success": False,
                "table_name": table_name,
                "error": str(e),
                "relationships": []
            }

    logger.info("[KG Relationships] Tool registered: get_table_relationships")