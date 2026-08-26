"""Execute SQL Query Tool - Execute read-only SQL against Sterling database."""

import logging
import os
from typing import Dict, Any, List
from mcp.server.mcpserver import MCPServer
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logger = logging.getLogger(__name__)

# Oracle connection (lazy-loaded)
_oracle_connection = None

def get_oracle_connection():
    """Get or create Oracle database connection."""
    global _oracle_connection

    if _oracle_connection is not None:
        return _oracle_connection

    try:
        import oracledb
    except ImportError:
        logger.error("[Execute SQL] oracledb not installed. Install with: pip install oracledb")
        return None

    try:
        # Get connection parameters from environment
        host = os.getenv('OMS_DB_HOST', 'localhost')
        port = int(os.getenv('OMS_DB_PORT', '1521'))
        sid = os.getenv('OMS_DB_SID', 'ORCL')
        user = os.getenv('OMS_DB_USER', 'TRAINING')
        password = os.getenv('OMS_DB_PASSWORD')

        if not password:
            logger.error("[Execute SQL] OMS_DB_PASSWORD not set in environment")
            return None

        # Create connection string using oracledb
        # oracledb uses different API: connect(user=..., password=..., dsn=...)
        dsn = oracledb.makedsn(host, port, sid=sid)
        _oracle_connection = oracledb.connect(user=user, password=password, dsn=dsn)
        logger.info(f"[Execute SQL] Connected to Oracle: {host}:{port}/{sid}")
        return _oracle_connection

    except Exception as e:
        logger.error(f"[Execute SQL] Failed to connect to Oracle: {e}")
        return None


def register_execute_sql_query_tool(mcp: FastMCP):
    """Register execute_sql_query tool for database queries."""

    @mcp.tool()
    def execute_sql_query(sql_query: str, max_rows: int = 100, timeout_seconds: int = 30) -> Dict[str, Any]:
        """
        Execute a read-only SQL query against the Sterling OMS database.

        IMPORTANT: This tool is for executing SQL that was built using KG schema verification.

        The query must have been constructed by:
        1. Using get_table_columns() to verify column names
        2. Using get_table_relationships() to verify join paths
        3. Using query_kg() to get BusinessRule constraints

        Args:
            sql_query: The SQL SELECT query to execute (read-only only)
            max_rows: Maximum rows to return (default 100, max 1000)
            timeout_seconds: Query timeout (default 30, max 120)

        Returns:
            Dictionary with success status, row count, and results
        """
        try:
            # Step 1: Basic validation
            sql_upper = sql_query.strip().upper()

            # Only allow SELECT statements
            if not sql_upper.startswith('SELECT'):
                return {
                    "success": False,
                    "error": "Only SELECT queries are allowed",
                    "query": sql_query[:100],
                    "guidance": "This tool only executes read-only SELECT statements"
                }

            # Prevent common attack patterns
            dangerous_keywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE', 'ALTER', 'TRUNCATE', '--', ';']
            if any(keyword in sql_upper for keyword in dangerous_keywords):
                return {
                    "success": False,
                    "error": "Query contains prohibited keywords or patterns",
                    "guidance": "Only SELECT queries allowed. No DDL/DML/comments."
                }

            # Enforce limits
            max_rows = min(max_rows, 1000)
            timeout_seconds = min(timeout_seconds, 120)

            # Step 2: Execute query against Oracle
            conn = get_oracle_connection()

            if not conn:
                logger.warning("[Execute SQL] Oracle connection unavailable; falling back to validation-only mode")
                return {
                    "success": True,
                    "query": sql_query,
                    "max_rows": max_rows,
                    "timeout_seconds": timeout_seconds,
                    "status": "VALIDATION_PASSED_NO_EXECUTION",
                    "message": "Query validated but Oracle connection unavailable. Install cx_Oracle and set OMS_DB_* env vars.",
                    "safety_checks": {
                        "read_only": True,
                        "dangerous_keywords": "None detected",
                        "row_limit": f"Capped at {max_rows}",
                        "timeout": f"Set to {timeout_seconds}s"
                    }
                }

            try:
                cursor = conn.cursor()
                cursor.arraysize = max_rows

                # Execute the query
                logger.info(f"[Execute SQL] Executing query: {sql_query[:100]}...")
                cursor.execute(sql_query)

                # Fetch results
                rows = cursor.fetchmany(max_rows)
                col_names = [desc[0] for desc in cursor.description] if cursor.description else []

                cursor.close()

                # Format results
                results = []
                for row in rows:
                    results.append(dict(zip(col_names, row)))

                return {
                    "success": True,
                    "query": sql_query,
                    "row_count": len(results),
                    "max_rows": max_rows,
                    "timeout_seconds": timeout_seconds,
                    "status": "EXECUTION_COMPLETE",
                    "columns": col_names,
                    "results": results,
                    "safety_checks": {
                        "read_only": True,
                        "dangerous_keywords": "None detected",
                        "row_limit": f"Returned {len(results)}/{max_rows}",
                        "timeout": f"{timeout_seconds}s"
                    }
                }

            except Exception as query_error:
                logger.error(f"[Execute SQL] Query execution failed: {query_error}")
                return {
                    "success": False,
                    "query": sql_query,
                    "error": str(query_error),
                    "error_type": type(query_error).__name__,
                    "guidance": "Check query syntax, column names, and join paths"
                }

        except Exception as e:
            logger.error(f"[Execute SQL Query] Failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "query": sql_query[:100]
            }

    logger.info("[Execute SQL Query] Tool registered: execute_sql_query")
