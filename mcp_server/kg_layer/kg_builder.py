"""KG Builder - Construct schema with actual Neo4J edges (Option B)."""

import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional

from .neo4j_client import Neo4JClient

logger = logging.getLogger(__name__)


class KGSchemaBuilder:
    """Build KG schema with EntityType nodes and actual relationship edges."""

    def __init__(self, client: Neo4JClient, sterling_analysis_path: str):
        """
        Initialize builder.

        Args:
            client: Neo4JClient instance
            sterling_analysis_path: Path to STERLING_OMS_ENTITIES_ANALYSIS.json
        """
        self.client = client
        self.sterling_analysis_path = sterling_analysis_path
        self.entities = []
        self.relationships = []
        self.domains = {}

    def load_sterling_analysis(self) -> bool:
        """Load entities and relationships from Sterling analysis JSON."""
        try:
            with open(self.sterling_analysis_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Extract domains and entities
            for domain in data.get('domains', []):
                domain_name = domain['name']
                self.domains[domain_name] = []

                for entity_name in domain.get('core_entities', []):
                    self.entities.append({
                        "name": entity_name,
                        "domain": domain_name,
                        "description": f"{entity_name} in {domain_name}",
                    })
                    self.domains[domain_name].append(entity_name)

            # Extract relationships
            for domain in data.get('domains', []):
                for rel_str in domain.get('key_relationships', []):
                    # Parse "YFS_ORDER_HEADER (1:N) YFS_ORDER_LINE"
                    parts = rel_str.split(' ')
                    if len(parts) >= 3:
                        source = parts[0]
                        cardinality = parts[1].strip('()')
                        target = parts[2]

                        # Infer relationship name
                        rel_name = self._infer_relationship_name(source, target)

                        self.relationships.append({
                            "name": rel_name,
                            "source": source,
                            "target": target,
                            "cardinality": cardinality,
                            "domain": domain['name'],
                        })

            logger.info(f"[KG Builder] Loaded {len(self.entities)} entities and {len(self.relationships)} relationships")
            return True

        except Exception as e:
            logger.error(f"[KG Builder] Failed to load Sterling analysis: {e}")
            return False

    def _infer_relationship_name(self, source: str, target: str) -> str:
        """Infer relationship name from source and target entity names."""
        # Simple heuristic: if target is in source name, use "HAS_X"
        source_parts = source.split('_')
        target_parts = target.split('_')

        # If they share common parts, they're related
        common = set(source_parts) & set(target_parts)

        if len(target_parts) > len(source_parts):
            # Target is more specific (e.g., ORDER_LINE from ORDER)
            suffix = '_'.join(target_parts[len(source_parts):])
            return f"HAS_{suffix}"
        else:
            # Generic relationship
            return f"RELATES_TO_{target_parts[-1]}"

    def create_entity_nodes(self) -> bool:
        """Create EntityType nodes for all entities (idempotent)."""
        created = 0
        for entity in self.entities:
            query = """
            MERGE (e:EntityType {name: $name})
            SET e.domain = $domain,
                e.description = $description
            RETURN e
            """
            try:
                self.client.run_query(
                    query,
                    {
                        "name": entity["name"],
                        "domain": entity["domain"],
                        "description": entity["description"],
                    }
                )
                created += 1
            except Exception as e:
                logger.error(f"[KG Builder] Failed to create entity {entity['name']}: {e}")
                return False

        logger.info(f"[KG Builder] Created {created} EntityType nodes")
        return True

    def create_relationship_edges(self) -> bool:
        """Create actual edges between EntityType nodes (idempotent)."""
        created = 0
        for rel in self.relationships:
            query = """
            MATCH (source:EntityType {name: $source})
            MATCH (target:EntityType {name: $target})
            MERGE (source)-[r:RELATES_TO {name: $rel_name, cardinality: $cardinality, domain: $domain}]->(target)
            RETURN r
            """
            try:
                self.client.run_query(
                    query,
                    {
                        "source": rel["source"],
                        "target": rel["target"],
                        "rel_name": rel["name"],
                        "cardinality": rel["cardinality"],
                        "domain": rel["domain"],
                    }
                )
                created += 1
            except Exception as e:
                logger.error(f"[KG Builder] Failed to create relationship {rel['name']}: {e}")
                # Don't fail the whole process, just log
                continue

        logger.info(f"[KG Builder] Created {created} relationship edges")
        return True

    def create_domain_nodes(self) -> bool:
        """Create Domain nodes and link to entities (idempotent)."""
        for domain_name, entities in self.domains.items():
            query = """
            MERGE (d:Domain {name: $domain_name})
            SET d.entity_count = $entity_count
            RETURN d
            """
            try:
                self.client.run_query(
                    query,
                    {
                        "domain_name": domain_name,
                        "entity_count": len(entities),
                    }
                )

                # Link Domain to EntityType nodes
                for entity_name in entities:
                    link_query = """
                    MATCH (d:Domain {name: $domain_name})
                    MATCH (e:EntityType {name: $entity_name})
                    MERGE (d)-[:CONTAINS]->(e)
                    RETURN 1
                    """
                    try:
                        self.client.run_query(
                            link_query,
                            {"domain_name": domain_name, "entity_name": entity_name}
                        )
                    except Exception as e:
                        logger.error(f"[KG Builder] Failed to link domain: {e}")

            except Exception as e:
                logger.error(f"[KG Builder] Failed to create domain {domain_name}: {e}")
                return False

        logger.info(f"[KG Builder] Created {len(self.domains)} Domain nodes")
        return True

    def get_stats(self) -> Dict[str, Any]:
        """Get schema statistics."""
        return {
            "entities": len(self.entities),
            "relationships": len(self.relationships),
            "domains": len(self.domains),
            "entities_by_domain": {d: len(e) for d, e in self.domains.items()},
        }
