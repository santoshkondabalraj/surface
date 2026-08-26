"""Knowledge Graph Loader - Parse ontology YAML and populate Neo4J."""

import os
import yaml
import json
import re
from pathlib import Path
from typing import Dict, Any, List
import logging

from .neo4j_client import Neo4JClient
from .neo4j_models import ENTITY_TYPES, RELATIONSHIPS, OPERATIONS
from .kg_builder import KGSchemaBuilder
from .kg_container_entities import add_container_entities
from .kg_table_extractor import extract_tables_from_json
from .kg_missing_descriptions import add_missing_descriptions

logger = logging.getLogger(__name__)


class KGLoader:
    """Load ontology from YAML and populate Neo4J KG."""

    def __init__(self, client: Neo4JClient, ontology_path: str):
        """
        Initialize loader.

        Args:
            client: Neo4JClient instance
            ontology_path: Path to ontology YAML file
        """
        self.client = client
        self.ontology_path = ontology_path
        self.ontology = None
        self.kg_version = None

    def load_ontology(self) -> bool:
        """Load ontology from YAML file."""
        try:
            with open(self.ontology_path, 'r', encoding='utf-8') as f:
                self.ontology = yaml.safe_load(f)
            self.kg_version = self.ontology.get('version', 'unknown')
            logger.info(f"[KG] Loaded ontology version {self.kg_version}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to load ontology: {e}")
            return False

    def setup_kg(self, force_reset: bool = False) -> bool:
        """
        Setup KG in Neo4J (idempotent).

        Args:
            force_reset: If True, delete all existing nodes first

        Returns:
            True if successful
        """
        if not self.ontology:
            if not self.load_ontology():
                return False

        # Check if KG already exists
        existing_version = self._get_current_kg_version()
        if existing_version == self.kg_version and not force_reset:
            logger.info(f"[KG] KG v{self.kg_version} already exists, skipping setup")
            return True

        # Only reset if force_reset is explicitly True
        # Do NOT reset just because metadata doesn't exist (schema may be created without metadata yet)
        if force_reset:
            logger.warning("[KG] Resetting KG (force_reset=True)")
            self.client.clear_all()
        elif existing_version is not None:
            # Metadata exists but is outdated - still need to update
            logger.info(f"[KG] Updating from v{existing_version} to v{self.kg_version}")
        else:
            # No metadata found - check if ANY nodes exist
            try:
                count_query = "MATCH (n) RETURN count(n) as count LIMIT 1"
                result = self.client.run_query(count_query)
                node_count = result[0]['count'] if result else 0
                if node_count > 0:
                    logger.info(f"[KG] Found existing KG with {node_count} nodes (no metadata), will update metadata")
                    # Nodes exist but no metadata - don't reset, just update metadata
                else:
                    logger.warning("[KG] Database empty, initializing fresh KG")
            except Exception as e:
                logger.debug(f"[KG] Could not check node count: {e}, proceeding with setup")

        # Create schema
        logger.info("[KG] Creating schema...")
        if not self._create_constraints():
            return False

        if not self._create_indices():
            return False

        # Store KG version metadata
        if not self._store_kg_metadata():
            return False

        logger.info(f"[KG] Setup complete v{self.kg_version}")
        return True

    def _create_constraints(self) -> bool:
        """Create uniqueness constraints (idempotent)."""
        constraints = [
            ("ORDER", "order_header_key"),
            ("ORDER_LINE", "order_line_key"),
            ("ORDER_RELEASE", "order_release_key"),
            ("SHIPMENT", "shipment_key"),
            ("SHIPMENT_LINE", "shipment_line_key"),
            ("SHIPMENT_CONTAINER", "shipment_container_key"),
            ("EXCEPTION", "errortxnid"),
        ]

        for label, prop in constraints:
            query = f"""
            CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label})
            REQUIRE n.{prop} IS UNIQUE
            """
            try:
                self.client.run_query(query)
                logger.debug(f"[KG] Constraint {label}.{prop}")
            except Exception as e:
                if "already exists" in str(e):
                    continue
                logger.error(f"[KG] Failed to create constraint {label}.{prop}: {e}")
                return False

        return True

    def _create_indices(self) -> bool:
        """Create indices for common queries (idempotent)."""
        indices = [
            ("ORDER", "enterprise_key"),
            ("ORDER", "order_no"),
            ("SHIPMENT", "shipment_no"),
            ("EXCEPTION", "flow_name"),
            ("EXCEPTION", "errorcode"),
        ]

        for label, prop in indices:
            query = f"""
            CREATE INDEX IF NOT EXISTS FOR (n:{label})
            ON (n.{prop})
            """
            try:
                self.client.run_query(query)
                logger.debug(f"[KG] Index {label}.{prop}")
            except Exception as e:
                if "already exists" in str(e):
                    continue
                logger.error(f"[KG] Failed to create index {label}.{prop}: {e}")
                return False

        return True

    def _store_kg_metadata(self) -> bool:
        """Store KG version and metadata as a node (idempotent)."""
        query = """
        MERGE (m:_KG_METADATA {id: 'metadata'})
        SET m.version = $version, m.updated = timestamp()
        RETURN m
        """
        try:
            self.client.run_query(query, {"version": self.kg_version})
            logger.debug(f"[KG] Stored metadata v{self.kg_version}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to store metadata: {e}")
            return False

    def _get_current_kg_version(self) -> str:
        """Get current KG version from Neo4J."""
        query = "MATCH (m:_KG_METADATA {id: 'metadata'}) RETURN m.version as version"
        try:
            result = self.client.run_query(query)
            return result[0]['version'] if result else None
        except Exception as e:
            logger.debug(f"[KG] No existing KG metadata: {e}")
            return None

    def load_entity_metadata(self) -> bool:
        """
        Load entity type metadata into Neo4J (idempotent).

        Creates nodes that describe entity types and operations.
        """
        # Skip if already loaded
        if self._get_current_kg_version() == self.kg_version:
            logger.debug(f"[KG] KG v{self.kg_version} already has entity metadata, skipping load")
            return True

        for entity_name, ops in OPERATIONS.items():
            query = """
            MERGE (e:EntityType {name: $name})
            SET e.operations = $operations
            RETURN e
            """
            try:
                self.client.run_query(
                    query,
                    {"name": entity_name, "operations": ops}
                )
                logger.debug(f"[KG] Loaded entity {entity_name}")
            except Exception as e:
                logger.error(f"[KG] Failed to load entity {entity_name}: {e}")
                return False

        return True

    def load_relationship_metadata(self) -> bool:
        """
        Load all 921 entities and their 1072 relationships with complete metadata.

        1. Load entities and relationships from pre-extracted JSON
        2. Create EntityType nodes with all metadata
        3. Create relationship edges with cardinality
        """
        # Skip if already loaded (idempotent via setup_kg version check)
        if self._get_current_kg_version() == self.kg_version:
            logger.debug(f"[KG] KG v{self.kg_version} already has relationship metadata, skipping load")
            return True

        try:
            json_path = "D:/Tastemaker_bot/oms_entities_detailed.json"

            if not Path(json_path).exists():
                logger.warning(f"[KG] JSON file not found at {json_path}, using minimal schema only")
                return self._create_minimal_schema()

            # Extract all tables and relationships from JSON
            logger.info("[KG] Loading 921 entities and 1072 relationships from pre-extracted JSON...")
            table_data = extract_tables_from_json(json_path)
            fk_data = table_data

            # STEP 1: Load ALL entities from the database schema (complete coverage)
            tables_with_fks = fk_data['tables']

            logger.info(f"[KG] Loading {len(tables_with_fks)} entities from database schema")
            created_count = 0
            for table_name, table_data in tables_with_fks.items():
                # Determine entity type from table name
                is_history = table_name.endswith('_H')
                is_view = table_name.endswith('_VW')
                entity_type = table_data.get('entity_type', 'transactional')
                if is_history:
                    entity_type = 'history'
                elif is_view:
                    entity_type = 'view'

                # Get metadata from JSON
                description = table_data.get('description', '')
                primary_key = table_data.get('primary_key', '')
                fks = table_data.get('foreign_keys', [])
                fk_count = len(fks)

                query = """
                MERGE (e:EntityType {name: $name})
                SET e.domain = 'Sterling OMS',
                    e.entity_type = $entity_type,
                    e.is_history = $is_history,
                    e.is_view = $is_view,
                    e.description = $description,
                    e.primary_key = $primary_key,
                    e.fk_count = $fk_count
                RETURN e
                """
                try:
                    self.client.run_query(
                        query,
                        {
                            "name": table_name,
                            "entity_type": entity_type,
                            "is_history": is_history,
                            "is_view": is_view,
                            "description": description or "",
                            "primary_key": primary_key or "",
                            "fk_count": fk_count,
                        }
                    )
                    created_count += 1
                except Exception as e:
                    logger.debug(f"[KG] Entity creation issue for {table_name}: {e}")
                    continue

            logger.info(f"[KG] Created {created_count} EntityType nodes from ERD")

            # STEP 2: Add missing descriptions for entities without ERD entries
            logger.info("[KG] Adding missing descriptions for initial entities...")
            missing_count = add_missing_descriptions(self.client)
            if missing_count > 0:
                logger.info(f"[KG] Added {missing_count} missing descriptions")

            # STEP 4: Create all relationship edges with metadata
            logger.info("[KG] Creating relationship edges (with implicit FK detection)...")
            rel_count = 0
            for table_name, table_data in tables_with_fks.items():
                # Use FKs from this table, history variant, or implicit patterns
                fks = table_data.get('foreign_keys', [])

                # If transactional table has no FKs, try history variant
                if not fks and not table_name.endswith('_H') and not table_name.endswith('_VW'):
                    history_name = f"{table_name}_H"
                    if history_name in fk_data['tables']:
                        fks = fk_data['tables'][history_name].get('foreign_keys', [])

                for fk in fks:
                    rel_meaning = self._get_relationship_meaning(table_name, fk["target_table"], fk["column"])

                    query = """
                    MATCH (source:EntityType {name: $source})
                    MATCH (target:EntityType {name: $target})
                    MERGE (source)-[r:RELATES_TO {column: $column}]->(target)
                    SET r.cardinality = $cardinality,
                        r.relationship_meaning = $meaning
                    RETURN r
                    """
                    try:
                        self.client.run_query(
                            query,
                            {
                                "source": table_name,
                                "target": fk["target_table"],
                                "column": fk["column"],
                                "cardinality": fk["cardinality"],
                                "meaning": rel_meaning or "",
                            }
                        )
                        rel_count += 1
                    except Exception as e:
                        logger.debug(f"[KG] Relationship creation issue: {e}")
                        continue

            logger.info(f"[KG] Created {rel_count} relationship edges with metadata")

            # Add container entities (enhanced with ORDER_RELEASE_KEY fix)
            if not add_container_entities(self.client):
                logger.warning("[KG] Failed to add container entities, continuing...")

            return True

        except Exception as e:
            logger.error(f"[KG] Failed to load relationship metadata: {e}")
            return False

    def _get_relationship_meaning(self, source: str, target: str, column: str) -> str:
        """Generate a human-readable meaning for a relationship."""
        if not column:
            return f"{source} relates to {target}"

        # Infer meaning from column name and target
        if "KEY" in column:
            col_clean = column.replace("_KEY", "").lower()
            return f"Link to {target} via {column} ({col_clean})"
        elif "NO" in column:
            return f"Reference to {target} by {column}"
        else:
            return f"{source} -> {target} ({column})"

    def _create_minimal_schema(self) -> bool:
        """Create minimal schema with initial 7 entities (fallback)."""
        try:
            for entity_name in ENTITY_TYPES.keys():
                query = """
                MERGE (e:EntityType {name: $name})
                SET e.domain = 'Order Management',
                    e.description = $desc
                """
                self.client.run_query(
                    query,
                    {
                        "name": entity_name,
                        "desc": f"{entity_name} entity",
                    }
                )

            for rel in RELATIONSHIPS:
                query = """
                MATCH (source:EntityType {name: $source})
                MATCH (target:EntityType {name: $target})
                MERGE (source)-[r:RELATES_TO {name: $rel_name, cardinality: $cardinality}]->(target)
                """
                self.client.run_query(
                    query,
                    {
                        "source": rel["source"],
                        "target": rel["target"],
                        "rel_name": rel["name"],
                        "cardinality": rel["cardinality"],
                    }
                )

            logger.info(f"[KG] Created minimal schema with {len(ENTITY_TYPES)} entities")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to create minimal schema: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get KG statistics."""
        stats = {
            "kg_version": self.kg_version,
            "neo4j_stats": self.client.get_stats(),
        }
        return stats


def initialize_kg(force_reset: bool = False) -> tuple[bool, str]:
    """
    Initialize Knowledge Graph (convenience function).

    Args:
        force_reset: If True, delete and recreate KG

    Returns:
        (success: bool, message: str)
    """
    try:
        # Get paths
        kg_dir = Path(__file__).parent
        ontology_path = kg_dir / "orderguard_ontology_v1.0.yaml"

        if not ontology_path.exists():
            return False, f"Ontology not found at {ontology_path}"

        # Initialize client
        client = Neo4JClient()
        if not client.verify_connection():
            return False, "Neo4J connection failed"

        # Load KG
        loader = KGLoader(client, str(ontology_path))
        if not loader.setup_kg(force_reset=force_reset):
            return False, "KG setup failed"

        if not loader.load_entity_metadata():
            return False, "Entity metadata load failed"

        if not loader.load_relationship_metadata():
            return False, "Relationship metadata load failed"

        stats = loader.get_stats()
        message = f"KG initialized v{stats['kg_version']}. Stats: {stats['neo4j_stats']}"
        logger.info(f"[KG] {message}")

        return True, message

    except Exception as e:
        logger.error(f"[KG] Initialization failed: {e}")
        return False, str(e)


if __name__ == "__main__":
    # Test setup
    logging.basicConfig(level=logging.INFO)
    success, message = initialize_kg(force_reset=False)
    print(f"Success: {success}")
    print(f"Message: {message}")
