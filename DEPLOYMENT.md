# Tastemaker Deployment Guide

**Last Updated**: 2026-08-25  
**Status**: Production Safety Ready

This guide covers deploying Tastemaker in production, with emphasis on operational safety and monitoring.

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Service Health Monitoring](#service-health-monitoring)
4. [Operational Safety](#operational-safety)
5. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

Before deploying to production:

- [ ] Neo4j database credentials configured in `frontend/.env`
- [ ] MCP server running and responding to `/mcp/health`
- [ ] Frontend API responding to `/api/health`
- [ ] Request logging configured (structured JSON to stdout)
- [ ] Request timeout set to 5 minutes (300 seconds)
- [ ] Tool inventory audit completed (see `mcp_server/TOOL_REGISTRY.md`)
- [ ] KG dependency map reviewed (see `mcp_server/KG_DEPENDENCY_MAP.md`)

---

## Environment Configuration

### MCP Server (backend)

**File**: `frontend/.env`

```bash
# Neo4j Configuration (REQUIRED for KG functionality)
NEO4J_URI=neo4j+s://your-neo4j-cluster.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-secure-password

# MCP Server Binding
MCP_HOST=0.0.0.0
MCP_PORT=8001

# Optional: Skip KG initialization for testing
# KG_LAYER_DISABLED=1
```

**Verification**:
```bash
cd mcp_server
python server.py
# Should print: [KG] OK (or [KG] DEGRADED if KG optional)
```

### Frontend (client)

**File**: `frontend/.env.local`

```bash
# API Endpoint
NEXT_PUBLIC_API_URL=http://localhost:8001
```

**Verification**:
```bash
cd frontend
npm run dev
# Navigate to http://localhost:3000
```

---

## Service Health Monitoring

### MCP Server Health Check

**Endpoint**: `GET /mcp/health`

```bash
curl http://localhost:8001/mcp/health
```

**Expected Response** (KG available):
```json
{
  "status": "healthy",
  "kg_available": true,
  "tools_active": 9,
  "database": {
    "status": "connected",
    "message": "Neo4j connected successfully"
  }
}
```

**Expected Response** (KG degraded):
```json
{
  "status": "degraded",
  "kg_available": false,
  "tools_active": 9,
  "database": {
    "status": "disconnected",
    "message": "ServiceUnavailable: Connection refused"
  }
}
```

### Frontend API Health Check

**Endpoint**: `GET /api/health`

```bash
curl http://localhost:3000/api/health
```

**Expected Response** (healthy):
```json
{
  "status": "healthy",
  "services": {
    "frontend": "ok",
    "mcp": "ok"
  }
}
```

**Expected Response** (degraded):
```json
{
  "status": "degraded",
  "services": {
    "frontend": "ok",
    "mcp": "unavailable"
  },
  "error": "MCP connection failed"
}
```

### Monitoring Setup (Prometheus/Grafana)

Add to your monitoring:

1. **Endpoint availability**:
   ```
   probe_success{endpoint="/api/health"} == 1
   probe_success{endpoint="/mcp/health"} == 1
   ```

2. **KG availability**:
   ```
   Parse /mcp/health response → alert if kg_available == false
   ```

3. **Request timeout alerts**:
   ```
   Watch for logs containing: event=timeout_exceeded
   ```

---

## Operational Safety

### Request Timeout Behavior

**Hard limit**: 5 minutes (300 seconds) per chat request

**Behavior**:
- 0-4 minutes: Normal operation
- 4-5 minutes: UI shows "Approaching timeout" warning to user
- 5+ minutes: Request terminated, error emitted

**Recovery**:
1. Client automatically receives error message
2. User can retry with simpler query
3. No manual intervention needed

### Knowledge Graph Availability

**If KG is unavailable**:

1. **Expected behavior**:
   - MCP server starts normally
   - All 9 tools register successfully
   - 4 KG-dependent tools fail gracefully on invocation
   - 5 KG-independent tools work normally

2. **Tools that work without KG**:
   - `retrieve_skills_tool` (skill discovery)
   - `get_sterling_columns` (schema lookup)
   - `query_sterling_database` (direct API calls)
   - `execute_sql_query` (direct database queries)
   - `refine_api_query_with_schema` (schema validation)

3. **On-call response**:
   - Check `/mcp/health` → if `kg_available: false`
   - Check Neo4j service health
   - Check network connectivity to Neo4j cluster
   - If recoverable: restart Neo4j or check credentials
   - If not recoverable: acknowledge degraded status; core functionality still available

### Request Logging

**Format**: Structured JSON to stdout (newline-delimited)

**Key events**:
- `request_start` — User query received
- `tool_call` — Tool execution started
- `request_end` — Query complete (success or timeout)
- `request_error` — Unexpected error

**Example**:
```json
{"requestId":"abc123","timestamp":"2026-08-25T20:47:18.000Z","event":"request_start","messageCount":1,"modelUsed":"claude-3-5-sonnet"}
{"requestId":"abc123","timestamp":"2026-08-25T20:47:19.234Z","event":"tool_call","toolName":"query_kg","durationMs":523,"iterationNumber":1}
{"requestId":"abc123","timestamp":"2026-08-25T20:47:20.567Z","event":"request_end","status":"complete","iterationsUsed":2,"totalOutputTokens":1842,"durationMs":2567}
```

**Parsing** (ELK / CloudWatch):
```bash
# Extract all request errors in last hour
cat /var/log/mcp.log | jq 'select(.event=="request_error")'

# Get average request duration
cat /var/log/mcp.log | jq 'select(.event=="request_end") | .durationMs' | \
  awk '{s+=$1; c++} END {print "avg:", s/c "ms"}'
```

---

## Troubleshooting

### MCP Server Won't Start

**Error**: `[KG] UNAVAILABLE Knowledge Graph initialization failed`

**Possible causes**:
1. Missing Neo4j credentials in `frontend/.env`
2. Neo4j server is not running
3. Network connectivity issue to Neo4j cluster

**Solution**:
```bash
# Check credentials
echo $NEO4J_URI
echo $NEO4J_USER
# (password should not be echoed)

# Test Neo4j connectivity
nc -zv <neo4j-host> 7687

# Or: start server anyway (degraded mode)
# KG-independent tools will work normally
python mcp_server/server.py
```

### Request Timeout on Long Queries

**Symptom**: "Request timeout exceeded" after 5 minutes

**Expected behavior**: By design. Long queries may need to be split.

**User guidance**:
1. Break query into multiple requests
2. Use pagination for large result sets
3. Simplify query to use fewer APIs

**To increase timeout** (not recommended):
1. Edit `frontend/src/app/api/chat/route.ts` line 199
2. Change `REQUEST_TIMEOUT_MS = 300_000` (5 min) to higher value
3. Also update Next.js `maxDuration` (line 9)
4. Redeploy frontend

### KG-Dependent Tools Failing

**Error**: `query_kg` returns `{success: false, error: "..."}`

**This is expected** if KG is unavailable. Check:
1. `curl http://localhost:8001/mcp/health` → is `kg_available: false`?
2. Neo4j service health
3. Network connectivity

**No action needed** if you accept degraded mode. Otherwise:
1. Restart Neo4j
2. Check and update credentials
3. Verify network access

### High Request Latency

**Symptom**: Requests taking 30+ seconds

**Investigation**:
```bash
# Check tool execution times in logs
cat /var/log/mcp.log | jq 'select(.event=="tool_call") | {tool: .toolName, duration: .durationMs}' | sort -k3 -rn | head -10

# Check which tool is slowest
cat /var/log/mcp.log | jq 'select(.event=="tool_call" and .toolName=="retrieve_skills_tool")'
```

**Common causes**:
1. `retrieve_skills_tool` (Pinecone): 2-2.4 seconds (expected)
2. KG queries (Neo4j): 300-700ms (expected)
3. API calls (OMS): 300-700ms (expected)

**If slower than expected**:
- Check network latency to external services
- Verify database indexes (Neo4j, Sterling)
- Check for query N+1 patterns in logs

---

## See Also

- `mcp_server/TOOL_REGISTRY.md` — Active tool list
- `mcp_server/KG_DEPENDENCY_MAP.md` — KG dependencies and fallback behavior
- `mcp_server/tools/deprecated/README.md` — Deprecated tools
- `README.md` — Getting started guide
