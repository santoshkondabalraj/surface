# Knowledge Graph Dependency Map

**Last Updated**: 2026-08-25  
**Status**: KG is OPTIONAL; system degrades gracefully if unavailable

This document maps which tools depend on the Neo4j Knowledge Graph (KG) and how they behave if the KG is unavailable.

---

## Tool Dependencies

### KG Required (4 tools)

These tools **will return errors** if the Knowledge Graph is unavailable, but they handle the error gracefully and the agentic loop can continue with alternative approaches.

| Tool | File | Dependency | Graceful Fallback |
|------|------|-----------|------------------|
| **query_kg** | `kg_query.py` | Neo4j database for entity/relationship queries | Returns `{success: false, error: "..."}` with error message. Agent can ask user for more specifics instead of querying KG. |
| **get_table_relationships** | `kg_relationships.py` | Neo4j for foreign key relationships | Returns `{success: false, relationships: [], error: "..."}` . Agent can try alternate approaches (schema inspection, direct SQL). |
| **lookup_exception_rules** | `exceptions.py` | Neo4j for exception definition nodes | Returns `{success: false, error: "..."}` . Agent asks user to specify exception type manually. |
| **lookup_status_code** | `status_code_lookup.py` | Neo4j for status code reference data | Returns `{success: false, error: "..."}` . Agent explains the issue to user. |

---

### KG Independent (5 tools)

These tools **do NOT require the KG** and will work normally even if Neo4j is completely unavailable.

| Tool | File | Why KG Not Needed | Alternate Source |
|------|------|-------------------|------------------|
| **retrieve_skills_tool** | `skill_retrieval.py` | Embeddings stored in Pinecone, not Neo4j | Pinecone vector database (separate from KG) |
| **get_sterling_columns** | `sterling_columns.py` | Schema queried directly from Sterling database | Sterling OMS database (via SQL) |
| **query_sterling_database** | `sterling.py` | Direct API calls to OMS | Sterling OMS API (no KG involvement) |
| **execute_sql_query** | `execute_sql_query.py` | Direct SQL to Sterling database | Sterling OMS database (via SQL) |
| **refine_api_query_with_schema** | `api_schema_tools.py` | Schema validation from XSD files, not KG | XML Schema Definition files (disk-based) |

---

## System Behavior

### When KG is Available
```
[KG] ✓ OK Neo4j connected successfully
   ✓ 9 tools registered
   ✓ 4 tools can query KG
   ✓ 5 tools work without KG
```

### When KG is Unavailable
```
[KG] ⚠ UNAVAILABLE Neo4j connection failed
   ✓ 9 tools registered (startup continues)
   ✗ 4 KG-dependent tools will fail gracefully
   ✓ 5 KG-independent tools work normally
   → Core functionality (SQL queries, skill lookup, API schema) unaffected
   → Degraded: relationship discovery, exception rules, status codes
```

### Impact Assessment

| Scenario | Impact | Severity | User Experience |
|----------|--------|----------|-----------------|
| **KG unavailable, user asks for schema relationship info** | Tool returns error; agent explains KG is down and suggests alternatives | Medium | User can proceed with schema inspection instead |
| **KG unavailable, user asks for order status** | Tool returns error; agent asks user to specify status type manually | Low | Slight friction; user provides clarification |
| **KG unavailable, user asks for API query help** | Tool works normally; user gets full API help (no KG rules, but XSD still works) | Very Low | No user-visible impact; full functionality |
| **KG unavailable, user queries database** | Tool works normally; all SQL queries execute successfully | None | No impact |

---

## Failure Modes

### KG Connection Failure

**Error Path**: `mcp_server/kg_layer/neo4j_client.py` (lines 44-52)

When Neo4j is unreachable:
1. Neo4j driver initialization succeeds (lazy connection)
2. First query attempt fails: `ServiceUnavailable` or `AuthError` exception
3. Exception caught in tool's try/except block
4. Tool returns error dict: `{success: false, error: "..."}`
5. Agent sees error and adapts

**Recovery**: Manual restart of Neo4j service or check network connectivity

### Missing Credentials

**Error Path**: `mcp_server/kg_layer/neo4j_client.py` (lines 26-39)

If Neo4j credentials missing from `frontend/.env`:

```python
NEO4J_URI = os.getenv("NEO4J_URI")           # Must be set
NEO4J_USERNAME = os.getenv("NEO4J_USER")     # Must be set
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD") # Must be set
```

**Behavior**: 
1. `initialize_kg()` raises `ValueError`
2. Server startup logs `[KG] ⚠ UNAVAILABLE` but continues
3. All tools register successfully
4. KG-dependent tools fail at invocation time

**Recovery**: Add Neo4j credentials to `frontend/.env`

### KG Initialization Failure

**Error Path**: `mcp_server/kg_layer/kg_loader.py` (lines 411-453)

Possible failure points:
- Missing ontology YAML file
- Constraint/index creation fails
- Entity/relationship metadata loading fails

**Behavior**: `initialize_kg()` returns `(False, error_message)`

**Server Response**:
```
[KG] ⚠ DEGRADED {error_message}
   Tools that depend on KG will fail gracefully
   Core functionality (SQL, skills) unaffected
```

**Recovery**: Check logs for specific failure; see DEPLOYMENT.md

---

## Monitoring & Health Checks

### Server Startup
```bash
# Start server and check KG status
python mcp_server/server.py

# Expected output (KG available):
# [KG] ✓ OK Neo4j connected successfully
# [MCP] All registered tools:
#   - retrieve_skills_tool
#   - query_kg
#   - ... (9 total)
```

### Health Endpoint
```bash
# Check KG status via health endpoint
curl http://localhost:8001/mcp/health

# Expected response (KG available):
# {
#   "status": "healthy",
#   "kg_available": true,
#   "database": {
#     "status": "connected",
#     "message": "Neo4j connected successfully"
#   }
# }

# Expected response (KG unavailable):
# {
#   "status": "degraded",
#   "kg_available": false,
#   "database": {
#     "status": "disconnected",
#     "message": "ServiceUnavailable: Connection failed"
#   }
# }
```

### Tool Status
```bash
# Verify tool registration (9 expected)
curl http://localhost:8001/mcp/tools | jq '.tools | length'
# Output: 9

# Test a KG-independent tool
curl http://localhost:8001/mcp/tools/get_sterling_columns
# Should work even if KG is down

# Test a KG-dependent tool
curl http://localhost:8001/mcp/tools/query_kg
# May fail gracefully if KG is down
```

---

## Recommendations

### For Production

1. **KG is Optional**: Don't treat KG unavailability as a production incident unless users are explicitly trying to use KG-dependent tools
2. **Monitor**: Use health endpoint in monitoring system to track KG status separately from API status
3. **Runbook**: Create on-call runbook for "KG unavailable" scenario (usually means Neo4j server down or network issue)

### For Development

1. **Testing**: Test both scenarios:
   - All systems nominal (KG available)
   - KG degraded (Neo4j unavailable, but system running)
2. **Local Development**: Can set `KG_LAYER_DISABLED=1` to skip KG initialization for faster iteration

### For Scaling

1. **Caching**: Consider caching KG query results (relationship queries especially)
2. **Connection Pooling**: Ensure Neo4j connection pooling is configured for high throughput
3. **Separate Deployments**: Consider running Neo4j on separate infrastructure from MCP server

---

## See Also

- `TOOL_REGISTRY.md` — List of all 9 active tools
- `server.py` — Tool registration code (lines 33-68)
- `tools/deprecated/README.md` — Deprecated tools
- `DEPLOYMENT.md` — Operational runbook (coming soon)
