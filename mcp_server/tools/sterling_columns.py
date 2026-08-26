"""Extract and cache table column information from skill_chunks_all.json"""

import json
import re
from pathlib import Path
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

# Path to the skill chunks file
SKILL_CHUNKS_PATH = "D:/Tastemaker_bot/mcp_server/data/skill_chunks_all.json"

# Cache for table columns (loaded once on first use)
_COLUMN_CACHE: Dict[str, List[Dict[str, str]]] = {}


def load_column_cache() -> Dict[str, List[Dict[str, str]]]:
    """Load and parse column information from skill_chunks_all.json.

    Returns:
        Dict mapping table_name -> list of {name, data_type, description}
    """
    global _COLUMN_CACHE

    if _COLUMN_CACHE:
        logger.debug("[Columns] Using cached column data")
        return _COLUMN_CACHE

    if not Path(SKILL_CHUNKS_PATH).exists():
        logger.warning(f"[Columns] Skill chunks file not found at {SKILL_CHUNKS_PATH}")
        return {}

    logger.info("[Columns] Loading column metadata from skill chunks...")

    try:
        with open(SKILL_CHUNKS_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)

        chunk_count = 0
        table_count = 0

        # Navigate nested structure: chunks_by_skill[skill_name][chunk_list]
        chunks_by_skill = data.get('chunks_by_skill', {})

        for skill_name, chunks in chunks_by_skill.items():
            for chunk in chunks:
                if isinstance(chunk, dict) and "content" in chunk:
                    chunk_count += 1
                    content = chunk["content"]

                    # Parse table sections: ## TABLE_NAME
                    # Look for pattern: ## YFS_*  or ## OMP_* or ## PLT_* or ## INV_*
                    # Handle both leading newline and start of content
                    table_sections = re.split(r'(?:^|\n)## ((?:YFS|OMP|PLT|INV|YDM|SC4)_[A-Z_]+)\n', content, flags=re.MULTILINE)

                    for i in range(1, len(table_sections), 2):
                        if i + 1 < len(table_sections):
                            table_name = table_sections[i].strip()
                            table_content = table_sections[i + 1]

                            if table_name and table_name not in _COLUMN_CACHE:
                                columns = _parse_column_table(table_content)
                                if columns:
                                    _COLUMN_CACHE[table_name] = columns
                                    table_count += 1

        logger.info(f"[Columns] Loaded {table_count} tables from {chunk_count} chunks")

    except Exception as e:
        logger.error(f"[Columns] Failed to load column cache: {e}")

    return _COLUMN_CACHE


def _parse_column_table(content: str) -> List[Dict[str, str]]:
    """Parse a markdown table of columns from table content.

    Format:
    | Column Name | Data Type | Description |
    |---|---|---|
    | `COLUMN_NAME` | Varchar2 (100) | Description here |
    """
    columns = []

    # Find the column table
    lines = content.split('\n')
    in_column_table = False

    for line in lines:
        # Look for table header
        if '| Column Name |' in line:
            in_column_table = True
            continue

        # Skip separator rows
        if line.startswith('|---'):
            continue

        # Stop at end of section (next ## or other markers)
        if in_column_table and (line.startswith('##') or line.startswith('**Indexes') or not line.startswith('|')):
            if columns:
                break

        # Parse column rows
        if in_column_table and line.startswith('|'):
            parts = [p.strip() for p in line.split('|')[1:-1]]  # Remove empty first/last

            if len(parts) >= 2:
                # Parse: | `COLUMN_NAME` | Data Type | Description |
                col_name = parts[0].strip('`').strip()
                data_type = parts[1] if len(parts) > 1 else ""
                description = parts[2] if len(parts) > 2 else ""

                if col_name and col_name != 'Column Name':
                    columns.append({
                        "name": col_name,
                        "data_type": data_type,
                        "description": description
                    })

    return columns


def get_table_columns(table_name: str) -> Dict[str, Any]:
    """Get columns for a specific table.

    Args:
        table_name: Full table name (e.g., "YFS_ORDER_HEADER")

    Returns:
        Dict with table info and column list
    """
    # Load cache if needed
    cache = load_column_cache()

    if table_name not in cache:
        # Try with YFS_ prefix if not provided
        if not table_name.startswith(('YFS_', 'OMP_', 'PLT_', 'INV_', 'YDM_', 'SC4_')):
            test_name = f"YFS_{table_name}"
            if test_name in cache:
                table_name = test_name
            else:
                return {
                    "success": False,
                    "error": f"Table '{table_name}' not found in Sterling OMS schema documentation",
                    "table_name": table_name,
                    "guidance": "BEFORE calling this tool, verify the table name exists by running: query_kg('AllNodeList'). Extract verified table names from results (e.g., ENTITY:YFS_INVENTORY_ITEM → YFS_INVENTORY_ITEM). Only then call get_sterling_columns with verified names.",
                    "columns": []
                }
        else:
            return {
                "success": False,
                "error": f"Table '{table_name}' not found in Sterling OMS schema documentation",
                "table_name": table_name,
                "guidance": "BEFORE calling this tool, verify the table name exists by running: query_kg('AllNodeList'). Extract verified table names from results (e.g., ENTITY:YFS_INVENTORY_ITEM → YFS_INVENTORY_ITEM). Only then call get_sterling_columns with verified names.",
                "columns": []
            }

    columns = cache[table_name]

    return {
        "success": True,
        "table_name": table_name,
        "column_count": len(columns),
        "columns": columns
    }


def register_sterling_columns_tool(mcp) -> None:
    """Register the tool with MCP server."""

    @mcp.tool()
    def get_sterling_columns(table_name: str) -> str:
        """Get exact column names, data types, and descriptions for any Sterling OMS table.

        CRITICAL: Call this tool BEFORE writing any SQL SELECT statement to validate column names.
        This prevents hallucinating column names that don't exist in the schema.

        Returns structured metadata with:
        - Complete column list (no partial data)
        - Data types (e.g., Varchar2, Char, Number, DateTime)
        - Column descriptions and FK references
        - Primary key information

        Example usage:
        1. User asks: "Get order total and customer name from order Y100001200"
        2. You call: get_sterling_columns("YFS_ORDER_HEADER")
        3. Tool returns: ORDER_TOTAL (Number), ORDER_NO (Varchar2), ... (all 133 columns)
        4. You write: SELECT ORDER_TOTAL, CUSTOMER_NAME FROM YFS_ORDER_HEADER WHERE ...
           (using only columns returned by tool, not hallucinated ones)

        Args:
            table_name: Full table name (e.g., "YFS_ORDER_HEADER", "YFS_SHIPMENT_LINE", "YFS_ORDER_LINE")
                       Prefix with YFS_, OMP_, PLT_, INV_, YDM_, or SC4_ for module prefix

        Returns:
            JSON string with:
            - success: boolean (true if table found)
            - table_name: the resolved table name
            - column_count: total columns in table
            - columns: array of {name, data_type, description}
            - error: error message if success=false
        """
        try:
            result = get_table_columns(table_name)
            return json.dumps(result, indent=2)
        except Exception as e:
            logger.error(f"[Sterling Columns] Error: {e}")
            return json.dumps({
                "success": False,
                "error": str(e),
                "table_name": table_name,
                "columns": []
            })

    logger.info("[MCP] get_sterling_columns tool registered successfully")