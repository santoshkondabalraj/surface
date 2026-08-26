"""Add missing container-related entities to KG."""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


# Container entities extracted from shipment skill files
CONTAINER_ENTITIES = [
    {
        "name": "YFS_SHIPMENT_CONTAINER",
        "domain": "Shipment Management",
        "description": "Physical container/box for shipment - primary container entity",
        "table": "yfs_shipment_container",
        "key_fields": ["shipment_container_key", "container_no"],
    },
    {
        "name": "YFS_CONTAINER_DETAILS",
        "domain": "Shipment Management",
        "description": "Container-level details - dimensions, weight, type, seal info",
        "table": "yfs_container_details",
        "key_fields": ["container_details_key"],
    },
    {
        "name": "YFS_CONTAINER_INNER_PACK",
        "domain": "Shipment Management",
        "description": "Inner packing structure within container",
        "table": "yfs_container_inner_pack",
        "key_fields": ["container_inner_pack_key"],
    },
    {
        "name": "YFS_CONTAINER_ITEM",
        "domain": "Shipment Management",
        "description": "Items packed within a container",
        "table": "yfs_container_item",
        "key_fields": ["container_item_key"],
    },
]

# Container relationships
CONTAINER_RELATIONSHIPS = [
    {
        "source": "YFS_SHIPMENT",
        "target": "YFS_SHIPMENT_CONTAINER",
        "name": "HAS_CONTAINER",
        "cardinality": "1:N",
        "domain": "Shipment Management",
    },
    {
        "source": "YFS_ORDER_RELEASE",
        "target": "YFS_SHIPMENT_CONTAINER",
        "name": "CONTAINS_CONTAINER",
        "cardinality": "1:N",
        "domain": "Shipment Management",
        "join_key": "ORDER_RELEASE_KEY",
        "description": "Direct FK: YFS_SHIPMENT_CONTAINER.ORDER_RELEASE_KEY = YFS_ORDER_RELEASE.ORDER_RELEASE_KEY",
    },
    {
        "source": "YFS_SHIPMENT_CONTAINER",
        "target": "YFS_CONTAINER_DETAILS",
        "name": "HAS_DETAILS",
        "cardinality": "1:1",
        "domain": "Shipment Management",
    },
    {
        "source": "YFS_SHIPMENT_CONTAINER",
        "target": "YFS_CONTAINER_INNER_PACK",
        "name": "CONTAINS_INNER_PACK",
        "cardinality": "1:N",
        "domain": "Shipment Management",
    },
    {
        "source": "YFS_CONTAINER_INNER_PACK",
        "target": "YFS_CONTAINER_ITEM",
        "name": "CONTAINS_ITEM",
        "cardinality": "1:N",
        "domain": "Shipment Management",
    },
    {
        "source": "YFS_SHIPMENT_LINE",
        "target": "YFS_CONTAINER_ITEM",
        "name": "PACKED_IN",
        "cardinality": "1:N",
        "domain": "Shipment Management",
    },
]


def add_container_entities(client) -> bool:
    """Add missing container entities and relationships to KG."""
    try:
        # Create entity nodes
        for entity in CONTAINER_ENTITIES:
            query = """
            MERGE (e:EntityType {name: $name})
            SET e.domain = $domain,
                e.description = $description,
                e.table = $table
            RETURN e
            """
            client.run_query(
                query,
                {
                    "name": entity["name"],
                    "domain": entity["domain"],
                    "description": entity["description"],
                    "table": entity.get("table", ""),
                }
            )
        logger.info(f"[KG Container] Added {len(CONTAINER_ENTITIES)} container entities")

        # Create relationship edges
        for rel in CONTAINER_RELATIONSHIPS:
            query = """
            MATCH (source:EntityType {name: $source})
            MATCH (target:EntityType {name: $target})
            MERGE (source)-[r:RELATES_TO {name: $rel_name, cardinality: $cardinality, domain: $domain}]->(target)
            RETURN r
            """
            try:
                client.run_query(
                    query,
                    {
                        "source": rel["source"],
                        "target": rel["target"],
                        "rel_name": rel["name"],
                        "cardinality": rel["cardinality"],
                        "domain": rel["domain"],
                    }
                )
            except Exception as e:
                logger.warning(f"[KG Container] Relationship {rel['name']} creation issue: {e}")
                continue

        logger.info(f"[KG Container] Added {len(CONTAINER_RELATIONSHIPS)} container relationships")
        return True

    except Exception as e:
        logger.error(f"[KG Container] Failed: {e}")
        return False
