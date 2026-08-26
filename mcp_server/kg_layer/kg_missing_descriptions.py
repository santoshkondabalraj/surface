"""Add missing entity descriptions to Neo4J KG."""

import logging
from typing import Dict, Any
from .neo4j_client import Neo4JClient

logger = logging.getLogger(__name__)

# Fallback descriptions for common Sterling OMS entities without ERD entries
MISSING_DESCRIPTIONS = {
    'ORDER': 'Sales order containing line items, customer, and fulfillment details',
    'ORDERLINE': 'Individual line item within an order (SKU, quantity, price)',
    'SHIPMENT': 'Fulfillment unit derived from order lines',
    'INVOICE': 'Billing document for order or shipment',
    'PAYMENT': 'Payment transaction record',
    'CUSTOMER': 'Customer/buyer information',
    'PRODUCT': 'Product/SKU catalog entry',
    'INVENTORY': 'Stock availability and allocation',
    'RECEIPT': 'Goods received acknowledgment',
    'RETURN': 'Return/RMA record',
    'EXCHANGE': 'Exchange transaction',
}


def add_missing_descriptions(client: Neo4JClient) -> int:
    """Add missing descriptions to entities without ERD entries.

    Args:
        client: Neo4JClient instance

    Returns:
        Count of entities updated with descriptions
    """
    if not client:
        return 0

    updated_count = 0

    for entity_name, description in MISSING_DESCRIPTIONS.items():
        try:
            query = """
            MATCH (e:EntityType {name: $name})
            WHERE e.description IS NULL OR e.description = ''
            SET e.description = $description
            RETURN e
            """
            result = client.run_query(query, {'name': entity_name, 'description': description})
            if result:
                updated_count += 1
        except Exception as e:
            logger.debug(f"[KG] Could not update {entity_name}: {e}")
            continue

    return updated_count
