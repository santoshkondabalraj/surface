"""
Phase 4: Simple wrapper to re-ingest enriched chunks to Pinecone without unicode issues.

Imports the restore function directly to avoid print() encoding issues.
"""

import json
import logging
from pathlib import Path
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add tools directory to path to import the restore function
sys.path.insert(0, 'mcp_server/tools')

def main(data_dir: str = 'mcp_server/data',
         namespace: str = 'tastemaker-bot',
         index_name: str = 'oms-skills-hybrid'):
    """
    Run Phase 4 Pinecone re-ingestion.
    """
    logger.info("")
    logger.info("="*60)
    logger.info("PHASE 4: Pinecone Re-ingestion")
    logger.info("="*60)
    logger.info("")

    # Import the restore function
    from restore_pinecone_from_archive import restore_pinecone_index

    # Run restoration
    result = restore_pinecone_index(
        archive_dir=data_dir,
        target_index=index_name,
        target_namespace=namespace,
        batch_size=100
    )

    # Log result
    if result.get('success'):
        logger.info("")
        logger.info("="*60)
        logger.info("SUCCESS: Phase 4 Complete!")
        logger.info("="*60)
        logger.info(f"Total chunks upserted: {result['total_upserted']}/{result['total_chunks']}")
        logger.info(f"Target index: {result['target_index']}")
        logger.info(f"Target namespace: {result['target_namespace']}")
        logger.info("")
        logger.info("Next steps:")
        logger.info("  1. Verify Pinecone index: check dashboard for updated chunk count")
        logger.info("  2. Test retrieve_skills_tool: should return schema_metadata")
        logger.info("  3. Run turntrace test: verify loop reduction (6 -> 3-4)")
        logger.info("")
    else:
        logger.error("")
        logger.error("="*60)
        logger.error("FAILED: Phase 4 Error")
        logger.error("="*60)
        logger.error(f"Error: {result.get('error', 'Unknown error')}")
        logger.error(f"Failed batches: {result.get('failed_batches', [])}")
        logger.error("")
        return 1

    return 0


if __name__ == '__main__':
    import os

    # Set UTF-8 encoding for stdout
    if sys.stdout.encoding != 'utf-8':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    data_dir = 'mcp_server/data'
    namespace = os.getenv('PINECONE_NAMESPACE', 'tastemaker-bot')
    index_name = os.getenv('PINECONE_INDEX_NAME', 'oms-skills-hybrid')

    exit_code = main(data_dir, namespace, index_name)
    sys.exit(exit_code)
