# Surface

Tastemaker is an order management and inventory intelligence platform powered by Plantrix. It provides real-time fulfillment health monitoring, order tracking, and inventory diagnostics through a modern web interface backed by a Model Context Protocol (MCP) server.

## Project Structure

```
Tastemaker/
├── frontend/              # Next.js 16 React application (Port 3000/3001)
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components
│   │   ├── context/      # React context (theme, etc.)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities and helpers
│   ├── package.json
│   └── tsconfig.json
│
├── mcp_server/            # MCP Server (Port 8001)
│   ├── server.py         # Main server entry point
│   ├── tools/            # MCP tool definitions
│   ├── prompts/          # MCP prompt definitions
│   ├── resources/        # MCP resource definitions
│   ├── kg_layer.py       # Knowledge Graph initialization
│   └── requirements.txt  # Python dependencies
│
├── start.ps1             # PowerShell startup script
└── README.md             # This file
```

## Features

- **Dashboard**: Real-time fulfillment health metrics and KPIs
- **Order Management**: Track and manage orders with status updates
- **Inventory Diagnostics**: Monitor stock levels, safety stock, and availability
- **Query Generator**: Transform natural language into SQL queries
- **Root Cause Analysis**: Investigate stuck orders and fulfillment issues
- **API Integration**: Connect with OMS (Order Management System)
- **Knowledge Graph**: Semantic understanding of tables, columns, and relationships

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **Git**
- Windows 10/11 (for PowerShell scripts)

## Quick Start

### Option 1: Using PowerShell Script (Recommended)

```powershell
# From the project root
.\start.ps1
```

This will automatically:
1. Activate the Python virtual environment
2. Start the MCP server on port 8001
3. Start the Next.js frontend on port 3000 (or 3001 if 3000 is busy)

### Option 2: Manual Setup

#### Step 1: Setup MCP Server

```bash
cd mcp_server

# Create and activate virtual environment (first time only)
python -m venv .venv
.\.venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Start the server
python server.py
```

The MCP server will start on `http://0.0.0.0:8001`

#### Step 2: Setup Frontend (in a new terminal)

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Ports

- **Frontend**: http://localhost:3000 (or 3001 if 3000 is busy)
- **MCP Server**: http://0.0.0.0:8001

## Configuration

### Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
# API endpoints
NEXT_PUBLIC_API_URL=http://localhost:8001
MCP_HOST=0.0.0.0
MCP_PORT=8001
```

### MCP Server Configuration

Edit `mcp_server/.env` for database and service credentials:

```env
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tastemaker

# API credentials
OMS_API_KEY=your_key_here
```

## Key Endpoints

### Frontend Pages

- `/` - Home page
- `/dashboard` - Main dashboard with fulfillment metrics
- `/chat` - Chat interface for queries

### MCP Server Endpoints

- `GET /sse` - Server-Sent Events stream
- `POST /messages` - Process tool calls and prompts

## Available Tools

The MCP server provides 9 active tools. **See [`mcp_server/TOOL_REGISTRY.md`](mcp_server/TOOL_REGISTRY.md) for the authoritative registry.**

### Quick Reference
- `retrieve_skills_tool` - Skill and domain detection
- `query_kg` - Knowledge Graph queries
- `get_table_relationships` - Table relationship lookup
- `get_sterling_columns` - Column schema information
- `query_sterling_database` - OMS API integration
- `execute_sql_query` - Execute SQL queries
- `get_api_schema` - API schema lookup
- `refine_api_query_with_schema` - Schema-based query refinement
- `lookup_status_code` - Status code reference

### Knowledge Graph (Optional)
The system includes a Neo4j-based Knowledge Graph that enhances tool capabilities. **The KG is optional; system degrades gracefully if unavailable.**

See [`mcp_server/KG_DEPENDENCY_MAP.md`](mcp_server/KG_DEPENDENCY_MAP.md) for:
- Which tools require KG
- Fallback behavior if KG is unavailable
- Health check commands

## Development

### Building Frontend

```bash
cd frontend
npm run build
npm run start
```

### TypeScript Configuration

The project targets ES2020 for regex flags and modern syntax support. See `frontend/tsconfig.json`.

### Running Tests

```bash
# Frontend tests
cd frontend
npm run test

# MCP Server tests
cd mcp_server
pytest
```

## Production Deployment

For production deployment, see [`DEPLOYMENT.md`](DEPLOYMENT.md) for:
- Pre-deployment checklist
- Environment configuration
- Health endpoint setup
- Monitoring integration
- Operational safety guidelines
- Troubleshooting runbook

**Quick health checks**:
```bash
# MCP server health
curl http://localhost:8001/mcp/health

# Frontend API health
curl http://localhost:3000/api/health
```

## Troubleshooting

### Port Already in Use

If port 3000 or 8001 is already in use:

```powershell
# Find process using port 8001
Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue

# Kill the process
Stop-Process -Id <PID> -Force
```

### Missing Dependencies

```bash
# Frontend
cd frontend && npm install

# MCP Server
cd mcp_server && pip install -r requirements.txt
```

### Knowledge Graph Issues

If the KG doesn't initialize:

```bash
cd mcp_server
python -c "from kg_layer import initialize_kg; initialize_kg(force_reset=True)"
```

**Note**: KG is optional. Core tools work without it. See [`mcp_server/KG_DEPENDENCY_MAP.md`](mcp_server/KG_DEPENDENCY_MAP.md) for details.

## Documentation

- `frontend/CLAUDE.md` - Claude AI-specific notes
- `frontend/AGENTS.md` - Agent configuration
- `frontend/SurfaceStylingSystemPrompt.md` - UI styling guidelines

## Architecture

### Frontend (Next.js)

- **Framework**: Next.js 16 with App Router
- **UI Library**: React 19 with Tailwind CSS
- **State Management**: Zustand
- **Markdown**: React Markdown with syntax highlighting (Shiki)
- **Client**: Anthropic SDK for Claude integration

### Backend (MCP Server)

- **Framework**: FastMCP (MCP 2.x)
- **Server**: Uvicorn + FastAPI
- **Database**: Connected to OMS database
- **Knowledge Graph**: Neo4j-based semantic layer
- **API Integration**: RESTful APIs for OMS and other services

## API Schema

The system manages 1276+ API schemas and includes XML example sets for common operations. Schemas are cached and validated through the API schema tools.

## Contributing

When making changes:

1. Update TypeScript/Python code with proper typing
2. Run tests locally before committing
3. Update relevant documentation
4. Follow the existing code style

## Stopping Servers

### Using PowerShell

```powershell
# Kill all Node processes
Get-Process node | Stop-Process -Force

# Kill all Python processes
Get-Process python | Stop-Process -Force

# Kill by specific port
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8001).OwningProcess -Force
```

### Using Command Line

```bash
# Unix/Git Bash
lsof -i :3000 | xargs kill -9
lsof -i :8001 | xargs kill -9
```

## License

Proprietary - Plantrix

## Support

For issues or questions, check the project documentation or contact the development team.
