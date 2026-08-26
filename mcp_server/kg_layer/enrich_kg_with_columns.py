"""
Enrich Knowledge Graph EntityType nodes with column metadata extracted from db-schema files.

This script:
1. Scans all db-schema-*.md files in the Sterling skills directory
2. Extracts table definitions and their columns
3. Adds a `columns` property to each EntityType node in Neo4j
4. Enables Claude to validate column names without hallucinating

Usage:
    python enrich_kg_with_columns.py
"""

import re
import os
from pathlib import Path
from neo4j import GraphDatabase
from typing import Dict, List, Tuple


SKILLS_DIR = r"D:\opt\IBM\xapidocs\ERD\.claude\skills"
DB_SCHEMA_DIR = os.path.join(SKILLS_DIR, "01-db-schema")


def extract_tables_from_schema(file_path: str) -> Dict[str, List[str]]:
    """Extract table names and their columns from a db-schema markdown file.

    Returns:
        Dict mapping table_name -> list of column names
    """
    tables = {}

    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for table headers: ## TABLE_NAME
        if line.startswith("## YFS_") or line.startswith("## OMP_") or line.startswith("## PLT_"):
            table_name = line.strip().replace("## ", "")
            columns = []

            # Skip to column table: look for "| Column Name |"
            for j in range(i + 1, min(i + 300, len(lines))):
                if "| Column Name |" in lines[j]:
                    # Collect columns from the table
                    for k in range(j + 2, len(lines)):
                        col_line = lines[k]

                        # Stop if we hit end of table or next section
                        if not col_line.startswith('|') or col_line.startswith('|---'):
                            break

                        # Parse column: | `COLUMN_NAME` | DataType | Description |
                        parts = col_line.split('|')
                        if len(parts) >= 2:
                            col_name = parts[1].strip('` \n')
                            if col_name and col_name != 'Column Name':
                                columns.append(col_name)

                    if columns:
                        tables[table_name] = columns
                    break

        i += 1

    return tables


def scan_all_schema_files() -> Dict[str, List[str]]:
    """Scan all db-schema-*.md files and extract tables + columns.

    Returns:
        Dict mapping table_name -> list of column names
    """
    all_tables = {}

    if not os.path.exists(DB_SCHEMA_DIR):
        print(f"ERROR: {DB_SCHEMA_DIR} does not exist")
        return all_tables

    schema_files = sorted(Path(DB_SCHEMA_DIR).glob("db-schema-*.md"))
    print(f"Found {len(schema_files)} schema files")

    for schema_file in schema_files:
        print(f"\nProcessing {schema_file.name}...")
        try:
            tables = extract_tables_from_schema(str(schema_file))
            print(f"  Extracted {len(tables)} tables")

            for table_name, columns in tables.items():
                if table_name in all_tables:
                    print(f"  WARNING: Duplicate table {table_name}, keeping first definition")
                else:
                    all_tables[table_name] = columns

        except Exception as e:
            print(f"  ERROR processing {schema_file.name}: {e}")

    return all_tables


def update_kg_with_columns(tables: Dict[str, List[str]]) -> Tuple[int, int]:
    """Update Neo4j KG EntityType nodes with column metadata.

    Args:
        tables: Dict mapping table_name -> list of column names

    Returns:
        Tuple of (updated_count, skipped_count)
    """
    # Connect to Neo4j
    uri = os.getenv("NEO4J_URI", "neo4j+s://8d4c95ba.databases.neo4j.io")
    user = os.getenv("NEO4J_USER", "plantrix_admin")
    password = os.getenv("NEO4J_PASSWORD", "password")

    driver = GraphDatabase.driver(uri, auth=(user, password))
    updated = 0
    skipped = 0

    try:
        with driver.session() as session:
            for table_name, columns in tables.items():
                column_list = ",".join(columns)

                # Update or create the entity with columns
                result = session.run(f"""
                MATCH (e:EntityType {{name: '{table_name}'}})
                SET e.columns = '{column_list}'
                RETURN e.name, size(e.columns)
                """)

                records = result.data()
                if records:
                    print(f"  OK {table_name}: {len(columns)} columns")
                    updated += 1
                else:
                    print(f"  -- {table_name}: not found in KG (skipped)")
                    skipped += 1

    finally:
        driver.close()

    return updated, skipped


def main():
    print("=== Enriching KG with Column Metadata ===\n")

    # Step 1: Extract tables from schema files
    print("Step 1: Extracting tables and columns from db-schema files...")
    tables = scan_all_schema_files()
    print(f"\nTotal tables found: {len(tables)}")

    if not tables:
        print("ERROR: No tables extracted. Exiting.")
        return

    # Show sample
    sample_tables = list(tables.items())[:3]
    for table_name, columns in sample_tables:
        print(f"\n  Example: {table_name}")
        print(f"    Columns ({len(columns)}): {','.join(columns[:5])}..." if len(columns) > 5 else f"    Columns: {','.join(columns)}")

    # Step 2: Update KG
    print("\n\nStep 2: Updating Neo4j Knowledge Graph...")
    try:
        updated, skipped = update_kg_with_columns(tables)
        print(f"\nOK: Updated {updated} EntityType nodes")
        print(f"Skipped {skipped} (not in KG)")

    except Exception as e:
        print(f"ERROR updating KG: {e}")
        return

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
