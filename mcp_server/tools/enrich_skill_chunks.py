"""
Phase 2: Parse API skill markdown files and link to schema enrichments.

This script:
1. Scans API skill markdown files from xapidocs
2. Extracts API names from markdown headers
3. Links each API to its schema enrichment metadata
4. Creates enrichment mapping for all skills

Usage:
    python enrich_skill_chunks.py [skills_dir] [enrichment_file] [output_file]
"""

import json
import re
import logging
from pathlib import Path
from typing import Dict, List, Any, Tuple
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def extract_api_names_from_markdown(content: str) -> List[str]:
    """
    Extract API names from markdown file.

    Looks for level-2 headers (## API_NAME) which indicate API definitions.

    Args:
        content: Markdown content

    Returns:
        List of API names found
    """
    # Match ## followed by API name (letter, underscore, number, lowercase)
    pattern = r'^## ([A-Za-z_][A-Za-z0-9_]*)\n'
    matches = re.findall(pattern, content, re.MULTILINE)
    return matches


def find_matching_schema(api_name: str, enrichments: Dict[str, Dict]) -> Tuple[Optional[str], Optional[Dict]]:
    """
    Find matching schema enrichment for an API name.

    Tries multiple naming conventions:
    - Direct match: api_name
    - With YFS_ prefix: YFS_{api_name}
    - With INV_ prefix: INV_{api_name}
    - Case-insensitive variants

    Args:
        api_name: API name to find
        enrichments: Dict of schema enrichments

    Returns:
        Tuple of (schema_key, enrichment_data) or (None, None) if not found
    """
    # Try direct match first
    if api_name in enrichments:
        return api_name, enrichments[api_name]

    # Try with common prefixes
    for prefix in ['YFS_', 'INV_', 'OM_', 'OMS_']:
        key = f"{prefix}{api_name}"
        if key in enrichments:
            return key, enrichments[key]

        # Also try uppercase
        key_upper = f"{prefix}{api_name.upper()}"
        if key_upper in enrichments:
            return key_upper, enrichments[key_upper]

    # Try without underscore variants
    api_name_lower = api_name.lower()
    for schema_key in enrichments.keys():
        if schema_key.lower().endswith(api_name_lower) or schema_key.lower().startswith(api_name_lower):
            return schema_key, enrichments[schema_key]

    return None, None


def process_skill_file(skill_file: Path, enrichments: Dict[str, Dict]) -> Dict[str, Any]:
    """
    Process a single API skill file.

    Args:
        skill_file: Path to skill markdown file
        enrichments: Dict of schema enrichments

    Returns:
        Enrichment info for this skill
    """
    try:
        with open(skill_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract skill metadata from frontmatter
        frontmatter_match = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
        skill_metadata = {}
        if frontmatter_match:
            # Simple YAML parsing for name and description
            fm = frontmatter_match.group(1)
            name_match = re.search(r'name:\s*(.+)', fm)
            if name_match:
                skill_metadata['name'] = name_match.group(1).strip()
            desc_match = re.search(r'description:\s*>?\s*(.+)', fm, re.DOTALL)
            if desc_match:
                skill_metadata['description'] = desc_match.group(1).strip()

        # Extract API names from markdown headers
        api_names = extract_api_names_from_markdown(content)

        # Find matching schemas
        enrichments_for_skill = []
        for api_name in api_names:
            schema_key, schema_data = find_matching_schema(api_name, enrichments)
            if schema_data:
                enrichments_for_skill.append({
                    'api_name': api_name,
                    'schema_key': schema_key,
                    'schema_data': schema_data
                })

        return {
            'skill_file': str(skill_file),
            'skill_name': skill_file.stem,
            'skill_metadata': skill_metadata,
            'api_names': api_names,
            'api_count': len(api_names),
            'enrichments': enrichments_for_skill,
            'enriched_count': len(enrichments_for_skill),
            'enrichment_rate': f"{len(enrichments_for_skill) / len(api_names) * 100:.1f}%" if api_names else "0%"
        }

    except Exception as e:
        logger.warning(f"Failed to process {skill_file}: {e}")
        return {
            'skill_file': str(skill_file),
            'error': str(e)
        }


def scan_skill_files(skills_dir: str) -> List[Path]:
    """
    Scan for API skill markdown files.

    Args:
        skills_dir: Directory containing skill files

    Returns:
        List of paths to API skill files
    """
    skills_path = Path(skills_dir)

    # Find all markdown files in directories starting with digits (API directories)
    api_files = []

    # Look for api-*.md files
    for api_file in skills_path.rglob('api-*.md'):
        api_files.append(api_file)

    logger.info(f"Found {len(api_files)} API skill files")
    return sorted(api_files)


def create_enrichment_mapping(enrichment_results: List[Dict[str, Any]]) -> Dict[str, Dict]:
    """
    Create mapping from skill name to enrichment data.

    Args:
        enrichment_results: List of per-skill enrichment results

    Returns:
        Dict mapping skill_name to enrichment info
    """
    mapping = {}

    for result in enrichment_results:
        if 'error' in result:
            continue

        skill_name = result.get('skill_name', '')
        mapping[skill_name] = {
            'api_names': result.get('api_names', []),
            'api_count': result.get('api_count', 0),
            'enrichments': result.get('enrichments', []),
            'enriched_count': result.get('enriched_count', 0),
            'enrichment_rate': result.get('enrichment_rate', '0%')
        }

    return mapping


def generate_statistics(enrichment_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate statistics about skill enrichment.

    Args:
        enrichment_results: List of per-skill enrichment results

    Returns:
        Statistics dict
    """
    successful = [r for r in enrichment_results if 'error' not in r]
    failed = [r for r in enrichment_results if 'error' in r]

    total_apis = sum(r.get('api_count', 0) for r in successful)
    total_enriched = sum(r.get('enriched_count', 0) for r in successful)
    total_skills = len(successful)

    # Group by enrichment rate
    full_enriched = sum(1 for r in successful if r.get('enriched_count', 0) == r.get('api_count', 0) and r.get('api_count', 0) > 0)
    partial_enriched = sum(1 for r in successful if 0 < r.get('enriched_count', 0) < r.get('api_count', 0))
    not_enriched = sum(1 for r in successful if r.get('enriched_count', 0) == 0)

    return {
        'total_skill_files': total_skills,
        'successful_files': len(successful),
        'failed_files': len(failed),
        'total_apis_found': total_apis,
        'total_apis_enriched': total_enriched,
        'enrichment_rate': f"{total_enriched / total_apis * 100:.1f}%" if total_apis > 0 else "0%",
        'skills_fully_enriched': full_enriched,
        'skills_partially_enriched': partial_enriched,
        'skills_not_enriched': not_enriched
    }


def main(skills_dir: str = 'D:/opt/IBM/xapidocs/ERD/.claude/skills/product_skills',
         enrichment_file: str = 'D:/Tastemaker_bot/mcp_server/tools/schema_enrichment_metadata.json',
         output_file: str = 'D:/Tastemaker_bot/mcp_server/tools/skill_enrichment_mapping.json'):
    """
    Main entry point for skill enrichment linking.

    Args:
        skills_dir: Directory containing API skill files
        enrichment_file: Path to schema enrichment metadata
        output_file: Path to output mapping file
    """
    logger.info(f"\n{'='*60}")
    logger.info("PHASE 2: Parse & Link API Skills to Schemas")
    logger.info(f"{'='*60}\n")

    logger.info(f"Skills directory: {skills_dir}")
    logger.info(f"Enrichment file:  {enrichment_file}")
    logger.info(f"Output file:      {output_file}\n")

    # Load enrichments
    logger.info("Loading schema enrichments...")
    with open(enrichment_file, 'r') as f:
        enrichments = json.load(f)
    logger.info(f"Loaded {len(enrichments)} enrichments\n")

    # Scan for skill files
    logger.info("Scanning for API skill files...")
    skill_files = scan_skill_files(skills_dir)
    logger.info(f"Found {len(skill_files)} skill files\n")

    # Process each skill file
    logger.info("Processing skill files...")
    enrichment_results = []
    for i, skill_file in enumerate(skill_files):
        if (i + 1) % 25 == 0:
            logger.info(f"Progress: {i + 1}/{len(skill_files)}")

        result = process_skill_file(skill_file, enrichments)
        enrichment_results.append(result)

    logger.info(f"Processed {len(enrichment_results)} skill files\n")

    # Create mapping
    logger.info("Creating enrichment mapping...")
    mapping = create_enrichment_mapping(enrichment_results)
    logger.info(f"Created mapping for {len(mapping)} skills\n")

    # Generate statistics
    stats = generate_statistics(enrichment_results)

    logger.info(f"{'='*60}")
    logger.info("ENRICHMENT STATISTICS")
    logger.info(f"{'='*60}")
    logger.info(f"Total skill files: {stats['total_skill_files']}")
    logger.info(f"Successful: {stats['successful_files']}, Failed: {stats['failed_files']}")
    logger.info(f"Total APIs found: {stats['total_apis_found']}")
    logger.info(f"Total APIs enriched: {stats['total_apis_enriched']}")
    logger.info(f"Overall enrichment rate: {stats['enrichment_rate']}")
    logger.info(f"\nEnrichment breakdown:")
    logger.info(f"  Fully enriched: {stats['skills_fully_enriched']}")
    logger.info(f"  Partially enriched: {stats['skills_partially_enriched']}")
    logger.info(f"  Not enriched: {stats['skills_not_enriched']}")
    logger.info(f"{'='*60}\n")

    # Save mapping
    logger.info(f"Saving enrichment mapping to {output_file}...")
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(mapping, f, indent=2)

    file_size_kb = output_path.stat().st_size / 1024
    logger.info(f"Saved successfully ({file_size_kb:.1f} KB)\n")

    # Save statistics
    stats_file = output_file.replace('.json', '_statistics.json')
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    logger.info(f"Statistics saved to {stats_file}")

    logger.info("✅ Phase 2 complete! Ready for Phase 3: Update skill chunks")

    return mapping, stats


if __name__ == '__main__':
    import sys

    skills_dir = sys.argv[1] if len(sys.argv) > 1 else 'D:/opt/IBM/xapidocs/ERD/.claude/skills/product_skills'
    enrichment_file = sys.argv[2] if len(sys.argv) > 2 else 'D:/Tastemaker_bot/mcp_server/tools/schema_enrichment_metadata.json'
    output_file = sys.argv[3] if len(sys.argv) > 3 else 'D:/Tastemaker_bot/mcp_server/tools/skill_enrichment_mapping.json'

    mapping, stats = main(skills_dir, enrichment_file, output_file)
