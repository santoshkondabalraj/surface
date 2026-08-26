"""Restore Pinecone index from preserved chunks in research_artifacts."""

import json
import logging
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def restore_pinecone_index(archive_dir: str = "research_artifacts/data_analysis",
                           target_index: str = None,
                           target_namespace: str = "production",
                           batch_size: int = 100) -> Dict[str, Any]:
    """
    Restore Pinecone index from preserved chunk JSON files.

    This script takes the preserved semantic chunks and bulk loads them into Pinecone,
    exactly replicating the original index structure.

    Args:
        archive_dir: Path to research_artifacts/data_analysis folder
        target_index: Pinecone index name (uses env var if None)
        target_namespace: Pinecone namespace (default: "production")
        batch_size: Chunks per batch (default: 100)

    Returns:
        Summary dict with statistics
    """
    from pinecone_upsert import PineconeUpsertManager

    # Initialize Pinecone manager
    try:
        manager = PineconeUpsertManager(index_name=target_index, namespace=target_namespace)
    except Exception as e:
        logger.error(f"Failed to initialize Pinecone: {e}")
        return {"success": False, "error": str(e)}

    archive_path = Path(archive_dir)
    if not archive_path.exists():
        error_msg = f"Archive directory not found: {archive_dir}"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    # Find all skill_chunks_*.json files
    chunk_files = sorted(archive_path.glob("skill_chunks_*.json"))
    if not chunk_files:
        error_msg = f"No skill_chunks_*.json files found in {archive_dir}"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    logger.info(f"Found {len(chunk_files)} chunk files in {archive_dir}")

    # Load and merge all chunks
    all_chunks = []
    total_size_kb = 0

    for chunk_file in chunk_files:
        logger.info(f"Loading {chunk_file.name}...")
        try:
            with open(chunk_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            chunks = data.get("chunks", [])
            logger.info(f"  → {len(chunks)} chunks loaded")
            all_chunks.extend(chunks)

            # Optionally track size
            file_size_kb = chunk_file.stat().st_size / 1024
            total_size_kb += file_size_kb

        except Exception as e:
            logger.error(f"  → Failed to load {chunk_file.name}: {e}")
            continue

    if not all_chunks:
        error_msg = "No chunks loaded from archive"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    logger.info(f"\n{'='*60}")
    logger.info(f"Total chunks to upsert: {len(all_chunks)}")
    logger.info(f"Total archive size: {total_size_kb:.1f} KB")
    logger.info(f"Target index: {target_index or 'default (oms-skills-hybrid)'}")
    logger.info(f"Target namespace: {target_namespace}")
    logger.info(f"Batch size: {batch_size}")
    logger.info(f"{'='*60}\n")

    # Upsert all chunks in batches
    total_upserted = 0
    failed_batches = []

    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i : i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(all_chunks) + batch_size - 1) // batch_size

        try:
            count = manager.upsert_chunks_batch(batch, batch_size=len(batch))
            total_upserted += count
            logger.info(f"Batch {batch_num}/{total_batches}: ✅ {count} chunks upserted")
        except Exception as e:
            logger.error(f"Batch {batch_num}/{total_batches}: ❌ Failed - {e}")
            failed_batches.append(batch_num)

    logger.info(f"\n{'='*60}")
    logger.info(f"Restoration complete!")
    logger.info(f"Total upserted: {total_upserted}/{len(all_chunks)}")
    if failed_batches:
        logger.warning(f"Failed batches: {failed_batches}")
    logger.info(f"{'='*60}\n")

    return {
        "success": len(failed_batches) == 0,
        "total_chunks": len(all_chunks),
        "total_upserted": total_upserted,
        "failed_batches": failed_batches,
        "archive_size_kb": total_size_kb,
        "target_index": target_index or "oms-skills-hybrid",
        "target_namespace": target_namespace,
    }


if __name__ == "__main__":
    import os
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s - %(message)s'
    )

    # Get arguments
    archive_dir = sys.argv[1] if len(sys.argv) > 1 else "research_artifacts/data_analysis"
    target_namespace = sys.argv[2] if len(sys.argv) > 2 else "production"

    # Optional: specify target index (default uses env var)
    target_index = sys.argv[3] if len(sys.argv) > 3 else None

    print(f"""
╔════════════════════════════════════════════════════════════════╗
║           RESTORE PINECONE FROM ARCHIVE                        ║
╚════════════════════════════════════════════════════════════════╝

Archive directory:  {archive_dir}
Target namespace:   {target_namespace}
Target index:       {target_index or 'default (env: PINECONE_INDEX_NAME)'}

Starting restoration...
""")

    # Run restoration
    result = restore_pinecone_index(
        archive_dir=archive_dir,
        target_index=target_index,
        target_namespace=target_namespace
    )

    # Print result
    print(f"""
{'✅' if result['success'] else '❌'} Restoration {'succeeded' if result['success'] else 'had issues'}

Summary:
  Total chunks:      {result['total_chunks']}
  Successfully upserted: {result['total_upserted']}
  Archive size:      {result['archive_size_kb']:.1f} KB
  Target:            {result['target_index']} / {result['target_namespace']}

  Failed batches:    {result['failed_batches'] if result['failed_batches'] else 'None'}
""")

    sys.exit(0 if result['success'] else 1)
