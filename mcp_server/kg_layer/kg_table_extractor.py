"""Extract table/entity data from OMS JSON schema."""

import json
from pathlib import Path
from typing import Dict, Any, List


def extract_tables_from_json(json_path: str) -> Dict[str, Any]:
    """Extract table structures and foreign key relationships from JSON.

    Args:
        json_path: Path to the OMS entities detailed JSON file

    Returns:
        Dict with 'tables' key containing all extracted table metadata
    """
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"[KG] Failed to load JSON from {json_path}: {e}")
        return {'tables': {}}

    tables = {}

    # Handle both flat array and nested structures
    entities = data if isinstance(data, list) else data.get('entities', [])

    for entity in entities:
        if isinstance(entity, dict):
            table_name = entity.get('table_name') or entity.get('name') or ''
            if not table_name:
                continue

            tables[table_name] = {
                'description': entity.get('description', ''),
                'entity_type': entity.get('entity_type', 'transactional'),
                'primary_key': entity.get('primary_key', ''),
                'foreign_keys': entity.get('foreign_keys', []) or [],
                'columns': entity.get('columns', []),
                'is_history': table_name.endswith('_H'),
                'is_view': table_name.endswith('_VW'),
            }

    return {'tables': tables}
