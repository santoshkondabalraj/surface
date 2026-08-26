"""Entity Mapper - Maps user input entities to database columns and values."""

import logging
from typing import Dict, List, Optional, NamedTuple

logger = logging.getLogger(__name__)


class EntityMapping(NamedTuple):
    """Entity mapping from user input to database."""
    entity_type: str  # "organization", "sku", "shipnode", etc.
    value: str  # The user-provided value
    db_table: str  # Target table
    db_column: str  # Target column
    search_type: str  # "exact" | "like" | "starts_with"
    confidence: float  # 0.0-1.0


class EntityMapper:
    """Maps user entities to database entities."""

    # Known organization mappings
    ORGANIZATION_MAPPINGS = {
        "aurora": {
            "db_table": "YFS_ORGANIZATION",
            "db_column": "ORGANIZATION_CODE",
            "value": "Aurora",
            "search_type": "exact",
            "confidence": 0.95
        },
        "nikeus": {
            "db_table": "YFS_ORGANIZATION",
            "db_column": "ORGANIZATION_CODE",
            "value": "NIKEUS",
            "search_type": "exact",
            "confidence": 0.95
        },
        "nike": {
            "db_table": "YFS_ORGANIZATION",
            "db_column": "ORGANIZATION_CODE",
            "value": "NIKEUS",
            "search_type": "exact",
            "confidence": 0.85
        },
    }

    # Ship node mappings
    SHIPNODE_MAPPINGS = {
        "wh001": {
            "db_table": "YFS_SHIP_NODE",
            "db_column": "SHIP_NODE",
            "value": "WH001",
            "search_type": "exact",
            "confidence": 0.95
        },
        "warehouse": {
            "db_table": "YFS_SHIP_NODE",
            "db_column": "SHIP_NODE",
            "value": "%WAREHOUSE%",
            "search_type": "like",
            "confidence": 0.70
        },
        "hub": {
            "db_table": "YFS_SHIP_NODE",
            "db_column": "SHIP_NODE",
            "value": "%HUB%",
            "search_type": "like",
            "confidence": 0.70
        },
    }

    @classmethod
    def map_entity(cls, entity_type: str, entity_value: str) -> Optional[EntityMapping]:
        """
        Map a user-provided entity to database column/value.

        Args:
            entity_type: Type of entity ("organization", "sku", "shipnode", etc.)
            entity_value: The user-provided value (e.g., "Aurora")

        Returns:
            EntityMapping with database details, or None if not found
        """

        entity_lower = entity_value.lower().strip()

        if entity_type == "organization":
            mapping = cls.ORGANIZATION_MAPPINGS.get(entity_lower)
            if mapping:
                return EntityMapping(
                    entity_type=entity_type,
                    value=entity_value,
                    db_table=mapping["db_table"],
                    db_column=mapping["db_column"],
                    search_type=mapping["search_type"],
                    confidence=mapping["confidence"]
                )

        elif entity_type == "shipnode":
            mapping = cls.SHIPNODE_MAPPINGS.get(entity_lower)
            if mapping:
                return EntityMapping(
                    entity_type=entity_type,
                    value=entity_value,
                    db_table=mapping["db_table"],
                    db_column=mapping["db_column"],
                    search_type=mapping["search_type"],
                    confidence=mapping["confidence"]
                )

        elif entity_type == "sku":
            # SKUs map to YFS_INVENTORY_ITEM.ITEM_ID
            return EntityMapping(
                entity_type=entity_type,
                value=entity_value,
                db_table="YFS_INVENTORY_ITEM",
                db_column="ITEM_ID",
                search_type="exact",
                confidence=0.90
            )

        # Unknown entity
        logger.warning(f"[Entity Mapper] Unknown entity: {entity_type}={entity_value}")
        return None

    @classmethod
    def build_where_clause(cls, mappings: List[EntityMapping]) -> str:
        """
        Build a WHERE clause from entity mappings.

        Args:
            mappings: List of EntityMapping objects

        Returns:
            WHERE clause string (e.g., "WHERE ii.ITEM_ID = 'GCL017_171602' AND org.ORGANIZATION_CODE = 'Aurora'")
        """

        conditions = []

        for mapping in mappings:
            table_alias = cls._get_table_alias(mapping.db_table)

            if mapping.search_type == "exact":
                conditions.append(f"{table_alias}.{mapping.db_column} = '{mapping.value}'")
            elif mapping.search_type == "like":
                conditions.append(f"{table_alias}.{mapping.db_column} LIKE '{mapping.value}'")
            elif mapping.search_type == "starts_with":
                conditions.append(f"{table_alias}.{mapping.db_column} LIKE '{mapping.value}%'")

        if not conditions:
            return ""

        return "WHERE " + " AND ".join(conditions)

    @classmethod
    def _get_table_alias(cls, table_name: str) -> str:
        """Get standard table alias for query building."""
        aliases = {
            "YFS_INVENTORY_ITEM": "ii",
            "YFS_ORGANIZATION": "org",
            "YFS_SHIP_NODE": "sn",
            "YFS_INVENTORY_SUPPLY": "sup",
            "YFS_INVENTORY_RESERVATION": "res",
            "YFS_INVENTORY_DEMAND": "dem",
        }
        return aliases.get(table_name, table_name[:2].lower())
