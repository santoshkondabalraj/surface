"""
Phase 3: Update skill_chunks_*.json with api_names + schema_metadata.

This script:
1. Loads all skill_chunks_*.json files
2. Loads the enrichment mapping from Phase 2
3. For each chunk:
   - Finds the matching skill in enrichment_mapping
   - Populates api_names field (currently empty)
   - Adds schema_metadata field
4. Saves updated chunks
5. Creates backup of originals

Usage:
    python update_skill_chunks.py [data_dir] [enrichment_file] [backup_dir]
"""

import json
import logging
import shutil
from pathlib import Path
from typing import Dict, List, Any, Tuple
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def find_skill_in_mapping(chunk: Dict[str, Any], enrichment_mapping: Dict[str, Any]) -> Tuple[Optional[str], Optional[Dict]]:
    """
    Find matching skill in enrichment mapping for a chunk.

    Tries multiple strategies:
    1. Direct skill_name match
    2. Partial name match from chunk metadata
    3. By comparing api_names in chunk

    Args:
        chunk: Skill chunk from skill_chunks_*.json
        enrichment_mapping: Mapping from Phase 2

    Returns:
        Tuple of (skill_name, enrichment_data) or (None, None) if not found
    """
    # Strategy 1: Direct match on skill_name from chunk
    if 'skill_name' in chunk and chunk['skill_name'] in enrichment_mapping:
        return chunk['skill_name'], enrichment_mapping[chunk['skill_name']]

    # Strategy 2: Match on filename stem (without .md)
    if 'skill_name' in chunk:
        skill_name = chunk['skill_name']
        # Remove extension
        if skill_name.endswith('.md'):
            skill_name = skill_name[:-3]
        if skill_name in enrichment_mapping:
            return skill_name, enrichment_mapping[skill_name]

    # Strategy 3: Fuzzy match on partial names
    chunk_name = chunk.get('skill_name', '').lower()
    for mapping_name, mapping_data in enrichment_mapping.items():
        if chunk_name in mapping_name.lower() or mapping_name.lower() in chunk_name:
            return mapping_name, mapping_data

    return None, None


def update_chunk_with_enrichment(chunk: Dict[str, Any], enrichment_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a single chunk with enrichment data.

    Args:
        chunk: Original chunk
        enrichment_data: Enrichment data from Phase 2

    Returns:
        Updated chunk
    """
    updated = chunk.copy()

    # 1. Populate api_names (currently empty!)
    api_names = enrichment_data.get('api_names', [])
    if api_names:
        updated['api_names'] = api_names

    # 2. Add schema_metadata
    enrichments = enrichment_data.get('enrichments', [])
    if enrichments:
        updated['schema_metadata'] = {
            'source': 'Phase 2 enrichment',
            'api_count': enrichment_data.get('api_count', 0),
            'enriched_count': enrichment_data.get('enriched_count', 0),
            'enrichment_rate': enrichment_data.get('enrichment_rate', '0%'),
            'apis': enrichments
        }

    return updated


def process_chunk_file(chunk_file: Path, enrichment_mapping: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process a single skill_chunks_*.json file.

    Args:
        chunk_file: Path to chunk file
        enrichment_mapping: Phase 2 enrichment mapping

    Returns:
        Statistics dict
    """
    logger.info(f"Processing {chunk_file.name}...")

    try:
        # Load chunks
        with open(chunk_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        chunks = data.get('chunks', [])
        logger.info(f"  Loaded {len(chunks)} chunks")

        # Update chunks
        updated_chunks = []
        enriched_count = 0
        api_names_populated = 0
        schema_metadata_added = 0

        for chunk in chunks:
            # Find matching enrichment
            skill_name, enrichment_data = find_skill_in_mapping(chunk, enrichment_mapping)

            if enrichment_data:
                # Update chunk
                updated_chunk = update_chunk_with_enrichment(chunk, enrichment_data)
                updated_chunks.append(updated_chunk)

                # Track statistics
                enriched_count += 1
                if 'api_names' in enrichment_data and enrichment_data['api_names']:
                    api_names_populated += 1
                if 'schema_metadata' in updated_chunk:
                    schema_metadata_added += 1
            else:
                # Keep original chunk if no enrichment found
                updated_chunks.append(chunk)

        # Prepare output
        output_data = data.copy()
        output_data['chunks'] = updated_chunks

        # Add metadata
        if 'metadata' not in output_data:
            output_data['metadata'] = {}
        output_data['metadata']['enrichment_applied'] = {
            'timestamp': datetime.now().isoformat(),
            'phase': 3,
            'source': 'Phase 2 enrichment mapping',
            'chunks_enriched': enriched_count,
            'api_names_populated': api_names_populated,
            'schema_metadata_added': schema_metadata_added
        }

        return {
            'file': chunk_file.name,
            'total_chunks': len(chunks),
            'enriched_chunks': enriched_count,
            'api_names_populated': api_names_populated,
            'schema_metadata_added': schema_metadata_added,
            'output_data': output_data,
            'success': True
        }

    except Exception as e:
        logger.error(f"  Failed to process {chunk_file.name}: {e}")
        return {
            'file': chunk_file.name,
            'error': str(e),
            'success': False
        }


def backup_original_files(data_dir: Path, backup_dir: Path) -> int:
    """
    Create backup of original skill_chunks_*.json files.

    Args:
        data_dir: Directory containing chunk files
        backup_dir: Backup directory

    Returns:
        Number of files backed up
    """
    logger.info(f"Creating backups in {backup_dir}...")

    backup_dir.mkdir(parents=True, exist_ok=True)

    backed_up = 0
    for chunk_file in data_dir.glob('skill_chunks_*.json'):
        backup_file = backup_dir / chunk_file.name
        shutil.copy2(chunk_file, backup_file)
        backed_up += 1
        logger.info(f"  Backed up {chunk_file.name}")

    logger.info(f"Backed up {backed_up} files\n")
    return backed_up


def save_updated_chunks(chunk_file: Path, output_data: Dict[str, Any]) -> None:
    """
    Save updated chunk data back to file.

    Args:
        chunk_file: Path to chunk file
        output_data: Updated chunk data
    """
    with open(chunk_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)


def generate_statistics(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate overall statistics from all file results.

    Args:
        results: List of per-file result dicts

    Returns:
        Statistics dict
    """
    successful = [r for r in results if r.get('success', False)]
    failed = [r for r in results if not r.get('success', False)]

    total_chunks = sum(r.get('total_chunks', 0) for r in successful)
    total_enriched = sum(r.get('enriched_chunks', 0) for r in successful)
    total_api_names = sum(r.get('api_names_populated', 0) for r in successful)
    total_schema_metadata = sum(r.get('schema_metadata_added', 0) for r in successful)

    return {
        'total_files': len(results),
        'successful_files': len(successful),
        'failed_files': len(failed),
        'total_chunks': total_chunks,
        'chunks_enriched': total_enriched,
        'api_names_populated': total_api_names,
        'schema_metadata_added': total_schema_metadata,
        'enrichment_rate': f"{total_enriched / total_chunks * 100:.1f}%" if total_chunks > 0 else "0%"
    }


def main(data_dir: str = 'D:/Tastemaker_bot/mcp_server/data',
         enrichment_file: str = 'D:/Tastemaker_bot/mcp_server/tools/skill_enrichment_mapping.json',
         backup_dir: str = 'D:/Tastemaker_bot/mcp_server/data/backups'):
    """
    Main entry point for skill chunk updating.

    Args:
        data_dir: Directory containing skill_chunks_*.json files
        enrichment_file: Path to Phase 2 enrichment mapping
        backup_dir: Directory for backups
    """
    logger.info(f"\n{'='*60}")
    logger.info("PHASE 3: Update Skill Chunks with Enrichment")
    logger.info(f"{'='*60}\n")

    logger.info(f"Data directory:     {data_dir}")
    logger.info(f"Enrichment file:    {enrichment_file}")
    logger.info(f"Backup directory:   {backup_dir}\n")

    # Load enrichment mapping
    logger.info("Loading enrichment mapping...")
    with open(enrichment_file, 'r') as f:
        enrichment_mapping = json.load(f)
    logger.info(f"Loaded {len(enrichment_mapping)} enrichments\n")

    # Create backups
    data_path = Path(data_dir)
    backup_path = Path(backup_dir)
    backed_up = backup_original_files(data_path, backup_path)

    # Find and process chunk files
    logger.info("Scanning for skill_chunks_*.json files...")
    chunk_files = sorted(data_path.glob('skill_chunks_*.json'))
    logger.info(f"Found {len(chunk_files)} chunk files\n")

    # Process each file
    logger.info("Processing chunk files...")
    results = []
    for chunk_file in chunk_files:
        result = process_chunk_file(chunk_file, enrichment_mapping)
        results.append(result)

        if result.get('success'):
            logger.info(f"  ✅ {result['file']}: {result['enriched_chunks']}/{result['total_chunks']} chunks enriched")
        else:
            logger.error(f"  ❌ {result['file']}: {result.get('error')}")

    logger.info("")

    # Save updated files
    logger.info("Saving updated chunk files...")
    saved_count = 0
    for i, chunk_file in enumerate(chunk_files):
        if results[i].get('success'):
            try:
                save_updated_chunks(chunk_file, results[i]['output_data'])
                saved_count += 1
                logger.info(f"  Saved {chunk_file.name}")
            except Exception as e:
                logger.error(f"  Failed to save {chunk_file.name}: {e}")

    logger.info("")

    # Generate statistics
    stats = generate_statistics(results)

    logger.info(f"{'='*60}")
    logger.info("UPDATE STATISTICS")
    logger.info(f"{'='*60}")
    logger.info(f"Files processed: {stats['successful_files']}/{stats['total_files']}")
    if stats['failed_files'] > 0:
        logger.warning(f"Failed files: {stats['failed_files']}")
    logger.info(f"Total chunks: {stats['total_chunks']}")
    logger.info(f"Chunks enriched: {stats['chunks_enriched']}")
    logger.info(f"api_names populated: {stats['api_names_populated']}")
    logger.info(f"schema_metadata added: {stats['schema_metadata_added']}")
    logger.info(f"Overall enrichment rate: {stats['enrichment_rate']}")
    logger.info(f"{'='*60}\n")

    # Save statistics
    stats_file = Path(data_dir) / 'phase3_update_statistics.json'
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    logger.info(f"Statistics saved to {stats_file}")

    logger.info("✅ Phase 3 complete! Ready for Phase 4: Pinecone re-ingestion")

    return results, stats


if __name__ == '__main__':
    import sys

    data_dir = sys.argv[1] if len(sys.argv) > 1 else 'D:/Tastemaker_bot/mcp_server/data'
    enrichment_file = sys.argv[2] if len(sys.argv) > 2 else 'D:/Tastemaker_bot/mcp_server/tools/skill_enrichment_mapping.json'
    backup_dir = sys.argv[3] if len(sys.argv) > 3 else 'D:/Tastemaker_bot/mcp_server/data/backups'

    results, stats = main(data_dir, enrichment_file, backup_dir)
