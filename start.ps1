2# start.ps1 - Start both the MCP server and Next.js frontend
$root = $PSScriptRoot

# Activate venv if present
$venvActivate = "$root\mcp_server\.venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    & $venvActivate
}

# Start MCP server in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\mcp_server'; python server.py"

# Start Next.js dev server in this window
Set-Location "$root\frontend"
npm run dev
