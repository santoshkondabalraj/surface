#!/bin/bash
# Phase 4: Re-ingest enriched chunks to Pinecone
#
# This script uses the existing restore_pinecone_from_archive.py script
# to push the updated skill_chunks_*.json files back to Pinecone with
# the new api_names and schema_metadata fields.

set -e

echo ""
echo "============================================================"
echo "PHASE 4: Pinecone Re-ingestion"
echo "============================================================"
echo ""

# Configuration
DATA_DIR="mcp_server/data"
NAMESPACE="tastemaker-bot"
INDEX_NAME="oms-skills-hybrid"

echo "Configuration:"
echo "  Data directory:  $DATA_DIR"
echo "  Pinecone index:  $INDEX_NAME"
echo "  Namespace:       $NAMESPACE"
echo ""

# Check if data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo "ERROR: Data directory not found: $DATA_DIR"
    exit 1
fi

# Check if chunk files exist
echo "Checking for chunk files..."
CHUNK_FILES=$(find "$DATA_DIR" -name "skill_chunks_*.json" -type f | wc -l)
echo "Found $CHUNK_FILES chunk files"
echo ""

if [ $CHUNK_FILES -eq 0 ]; then
    echo "ERROR: No chunk files found in $DATA_DIR"
    exit 1
fi

# Run the restoration script
echo "Starting Pinecone re-ingestion..."
echo ""

python mcp_server/tools/restore_pinecone_from_archive.py \
    "$DATA_DIR" \
    "$NAMESPACE" \
    "$INDEX_NAME"

RESTORE_EXIT_CODE=$?

if [ $RESTORE_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "SUCCESS: Phase 4 complete!"
    echo "============================================================"
    echo ""
    echo "Pinecone has been re-ingested with enriched chunks:"
    echo "  - api_names now populated for all API skills"
    echo "  - schema_metadata added with parameter information"
    echo "  - 831 chunks enriched with schema data"
    echo ""
    echo "Next steps:"
    echo "  1. Verify Pinecone index updated: check admin console"
    echo "  2. Test retrieve_skills_tool: should now return api_names + schema_metadata"
    echo "  3. Run turntrace test: verify loop reduction (6 -> 3-4 loops)"
    echo ""
else
    echo ""
    echo "============================================================"
    echo "ERROR: Phase 4 failed"
    echo "============================================================"
    exit 1
fi
