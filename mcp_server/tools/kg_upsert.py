"""Upsert business rules and entities into Neo4J Knowledge Graph."""

import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

sys.path.insert(0, str(Path(__file__).parent.parent))

from kg_layer import Neo4JClient

logger = logging.getLogger(__name__)


class KGUpsertManager:
    """Manage upserts of entities, rules, and relationships into Neo4J KG."""

    def __init__(self):
        self.client = Neo4JClient()
        if not self.client.verify_connection():
            raise RuntimeError("Neo4J connection failed")

    def upsert_entity(self, entity_name: str, entity_type: str, metadata: Dict[str, Any]) -> bool:
        """
        Upsert an entity (e.g., Order, Shipment, Invoice).

        Args:
            entity_name: Name of the entity (e.g., "ORDER")
            entity_type: Type (e.g., "transactional", "history", "view")
            metadata: Dict with description, primary_key, columns, etc.

        Returns:
            True if successful
        """
        try:
            query = """
            MERGE (e:EntityType {name: $name})
            SET e.entity_type = $entity_type,
                e.description = $description,
                e.primary_key = $primary_key,
                e.domain = 'Sterling OMS',
                e.is_history = $is_history,
                e.is_view = $is_view,
                e.updated_at = timestamp()
            RETURN e
            """
            self.client.run_query(
                query,
                {
                    "name": entity_name,
                    "entity_type": entity_type,
                    "description": metadata.get("description", ""),
                    "primary_key": metadata.get("primary_key", ""),
                    "is_history": entity_name.endswith("_H"),
                    "is_view": entity_name.endswith("_VW"),
                }
            )
            logger.info(f"[KG] Upserted entity: {entity_name}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to upsert entity {entity_name}: {e}")
            return False

    def upsert_atomic_rule(self, rule_id: str, rule_name: str, description: str, rule_logic: str,
                           workstream: str, entities: List[str]) -> bool:
        """
        Upsert an atomic business rule.

        Args:
            rule_id: Unique rule ID (e.g., "BR001")
            rule_name: Human-readable name (e.g., "Payment Authorization Required")
            description: What the rule checks
            rule_logic: Pseudocode or SQL-like logic
            workstream: Related workstream (e.g., "Order Capture")
            entities: List of entities this rule applies to

        Returns:
            True if successful
        """
        try:
            query = """
            MERGE (r:AtomicRule {rule_id: $rule_id})
            SET r.name = $name,
                r.description = $description,
                r.rule_logic = $rule_logic,
                r.workstream = $workstream,
                r.updated_at = timestamp()
            RETURN r
            """
            self.client.run_query(
                query,
                {
                    "rule_id": rule_id,
                    "name": rule_name,
                    "description": description,
                    "rule_logic": rule_logic,
                    "workstream": workstream,
                }
            )

            # Link rule to entities
            for entity in entities:
                link_query = """
                MATCH (r:AtomicRule {rule_id: $rule_id})
                MATCH (e:EntityType {name: $entity})
                MERGE (r)-[:APPLIES_TO]->(e)
                """
                self.client.run_query(link_query, {"rule_id": rule_id, "entity": entity})

            logger.info(f"[KG] Upserted atomic rule: {rule_id}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to upsert rule {rule_id}: {e}")
            return False

    def upsert_conditional_rule(self, rule_id: str, rule_name: str, condition: str,
                                actions: List[str], workstream: str) -> bool:
        """
        Upsert a conditional rule (if-then logic).

        Args:
            rule_id: Unique rule ID (e.g., "CR001")
            rule_name: Name of the rule
            condition: Condition that triggers the rule
            actions: List of actions when condition is met
            workstream: Related workstream

        Returns:
            True if successful
        """
        try:
            query = """
            MERGE (r:ConditionalRule {rule_id: $rule_id})
            SET r.name = $name,
                r.condition = $condition,
                r.actions = $actions,
                r.workstream = $workstream,
                r.updated_at = timestamp()
            RETURN r
            """
            self.client.run_query(
                query,
                {
                    "rule_id": rule_id,
                    "name": rule_name,
                    "condition": condition,
                    "actions": actions,
                    "workstream": workstream,
                }
            )
            logger.info(f"[KG] Upserted conditional rule: {rule_id}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to upsert conditional rule {rule_id}: {e}")
            return False

    def upsert_relationship(self, source_entity: str, target_entity: str, relationship_name: str,
                            cardinality: str) -> bool:
        """
        Upsert a relationship between two entities.

        Args:
            source_entity: Source entity name (e.g., "ORDER")
            target_entity: Target entity name (e.g., "SHIPMENT")
            relationship_name: Name of relationship (e.g., "HAS_SHIPMENT")
            cardinality: Cardinality (e.g., "1:N", "N:1")

        Returns:
            True if successful
        """
        try:
            query = """
            MATCH (source:EntityType {name: $source})
            MATCH (target:EntityType {name: $target})
            MERGE (source)-[r:RELATES_TO {name: $rel_name}]->(target)
            SET r.cardinality = $cardinality,
                r.updated_at = timestamp()
            RETURN r
            """
            self.client.run_query(
                query,
                {
                    "source": source_entity,
                    "target": target_entity,
                    "rel_name": relationship_name,
                    "cardinality": cardinality,
                }
            )
            logger.info(f"[KG] Upserted relationship: {source_entity} -[{relationship_name}]-> {target_entity}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to upsert relationship: {e}")
            return False

    def delete_entity(self, entity_name: str) -> bool:
        """Delete an entity and all its relationships."""
        try:
            query = """
            MATCH (e:EntityType {name: $name})
            DETACH DELETE e
            """
            self.client.run_query(query, {"name": entity_name})
            logger.info(f"[KG] Deleted entity: {entity_name}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to delete entity {entity_name}: {e}")
            return False

    def delete_rule(self, rule_id: str) -> bool:
        """Delete a rule and all its relationships."""
        try:
            query = """
            MATCH (r:AtomicRule {rule_id: $rule_id})
            DETACH DELETE r
            """
            self.client.run_query(query, {"rule_id": rule_id})
            logger.info(f"[KG] Deleted rule: {rule_id}")
            return True
        except Exception as e:
            logger.error(f"[KG] Failed to delete rule {rule_id}: {e}")
            return False

    def close(self):
        """Close Neo4J connection."""
        self.client.close()


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)

    manager = KGUpsertManager()

    # Example: Upsert a new entity
    manager.upsert_entity(
        "CUSTOM_ORDER",
        "transactional",
        {
            "description": "Custom order with special handling",
            "primary_key": "ORDER_ID",
        }
    )

    # Example: Upsert an atomic rule
    manager.upsert_atomic_rule(
        "BR999",
        "Custom Business Rule",
        "Example rule for demonstration",
        "IF order.status = 'PENDING' AND payment.status = 'AUTHORIZED' THEN release_order()",
        "Order Capture",
        ["ORDER", "PAYMENT"]
    )

    # Example: Upsert a relationship
    manager.upsert_relationship(
        "ORDER",
        "CUSTOM_ORDER",
        "EXTENDS",
        "1:1"
    )

    manager.close()
    print("✅ KG upsert example complete")
