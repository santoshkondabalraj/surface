# MCP Tool Registry

**Last Updated**: 2026-08-25  
**Total Active Tools**: 9  
**Status**: Production

This document is the authoritative registry of all MCP tools exposed by the Tastemaker server.

---

## Active Tools

| Tool Name | File | Purpose | KG Required | Status | Last Reviewed |
|-----------|------|---------|-------------|--------|---------------|
| `retrieve_skills_tool` | `skill_retrieval.py` | Semantic skill/domain discovery via Pinecone embedding search | No | ACTIVE | 2026-08-25 |
| `query_kg` | `kg_query.py` | Query Knowledge Graph for entity metadata, relationships, and business rules | Yes | ACTIVE | 2026-08-25 |
| `get_table_relationships` | `kg_relationships.py` | Discover foreign key relationships between Sterling OMS tables | Yes | ACTIVE | 2026-08-25 |
| `get_sterling_columns` | `sterling_columns.py` | Get column schema (names, types, nullability) for Sterling tables | No | ACTIVE | 2026-08-25 |
| `query_sterling_database` | `sterling.py` | Execute parameterized OMS API calls and queries | No | ACTIVE | 2026-08-25 |
| `lookup_exception_rules` | `exceptions.py` | Look up exception handling rules and definitions | Yes | ACTIVE | 2026-08-25 |
| `lookup_status_code` | `status_code_lookup.py` | Map status codes to human-readable descriptions | Yes | ACTIVE | 2026-08-25 |
| `execute_sql_query` | `execute_sql_query.py` | Execute arbitrary SQL queries with parameter binding | No | ACTIVE | 2026-08-25 |
| `refine_api_query_with_schema` | `api_schema_tools.py` | Validate and refine API query parameters against XSD schemas (two-step refinement) | No | ACTIVE | 2026-08-25 |

---

## Tool Usage Patterns

### By Knowledge Graph Dependency

**KG Required** (Tools that fail gracefully if KG unavailable):
- `query_kg` — Returns `{success: false}` if KG unavailable
- `get_table_relationships` — Returns empty relationships + error message
- `lookup_exception_rules` — Returns `{success: false}` if KG unavailable
- `lookup_status_code` — Returns `{success: false}` if KG unavailable

**KG Independent** (Tools that work without KG):
- `retrieve_skills_tool` — Skill embeddings stored in Pinecone, not Neo4j
- `get_sterling_columns` — Connects directly to Sterling database
- `query_sterling_database` — Direct OMS API calls
- `execute_sql_query` — Direct SQL to Sterling database
- `refine_api_query_with_schema` — Schema validation only, no KG queries

**Recommendation**: KG is optional for core functionality. System degrades gracefully if Neo4j unavailable.

---

## Tool Registration

All tools are registered in `mcp_server/server.py` (lines 33-68):

```python
# ============================================================================
# TOOL REGISTRATION (9 active tools)
# See mcp_server/TOOL_REGISTRY.md for full registry
# Deprecated tools moved to tools/deprecated/ - see tools/deprecated/README.md
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
```

---

## Deprecated Tools

For historical reference, deprecated tools have been moved to `tools/deprecated/`:
- `domain_intent_detector.py` → Replaced by `retrieve_skills_tool`
- `kg_columns.py` → Replaced by `get_sterling_columns`
- `api_refiner.py` → Merged into `api_schema_tools.py`
- `query_table_data.py` → Replaced by `execute_sql_query`

See `tools/deprecated/README.md` for details.

---

## Adding a New Tool

When adding a new MCP tool:

1. Create `tools/new_tool_name.py` with a `register_new_tool_name(mcp)` function
2. Register it in `server.py` (lines 33-68)
3. Add it to this registry with:
   - Tool name
   - File path
   - Purpose (1-2 lines)
   - KG dependency (Yes/No)
   - Status (ACTIVE)
   - Last reviewed date
4. Update line count in section header

---

## Monitoring

### Health Check
```bash
# Verify all 9 tools are registered
curl http://localhost:8001/mcp/tools | jq '.tools | length'
# Should output: 9
```

### Tool-Specific Checks
```bash
# Test retrieve_skills_tool (no KG required)
curl http://localhost:8001/mcp/tools/retrieve_skills_tool

# Test query_kg (KG required)
curl http://localhost:8001/mcp/tools/query_kg
```

---

## Change Log

- **2026-08-25**: Initial registry created with 9 active tools documented
