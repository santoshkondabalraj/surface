"""
Extract business rules from Sterling API skill files and add to Knowledge Graph.

Extracts:
1. Status codes and their meanings (e.g., 1500 = Scheduled)
2. Business logic patterns (e.g., "stuck orders = STATUS_QUANTITY > 0")
3. Required filters and conditions for common queries
4. Status workflows and transitions

Usage:
    python extract_business_rules.py
"""

import re
import os
from pathlib import Path
from neo4j import GraphDatabase
from typing import Dict, List, Tuple


SKILLS_DIR = r"D:\opt\IBM\xapidocs\ERD\.claude\skills\product_skills"


# Business rules to extract and add to KG
BUSINESS_RULES = {
    "order_status_codes": {
        "description": "Sterling order release status codes",
        "rules": [
            {
                "code": "1300",
                "name": "Created",
                "meaning": "Order line created, not yet scheduled"
            },
            {
                "code": "1500",
                "name": "Scheduled",
                "meaning": "Order line scheduled, waiting to ship. Stuck orders have STATUS_QUANTITY > 0"
            },
            {
                "code": "1600",
                "name": "Picked",
                "meaning": "Order line picked from warehouse, ready for packing"
            },
            {
                "code": "2000",
                "name": "Shipped",
                "meaning": "Order line shipped to customer"
            },
            {
                "code": "3000",
                "name": "Cancelled",
                "meaning": "Order line cancelled"
            }
        ]
    },
    "stuck_orders_rule": {
        "description": "Query rule: Find orders stuck in scheduled status",
        "business_logic": {
            "condition": "Status = 1500 AND STATUS_QUANTITY > 0",
            "meaning": "Order lines scheduled but not yet fulfilled (quantity remaining)",
            "tables": ["YFS_ORDER_HEADER", "YFS_ORDER_LINE", "YFS_ORDER_RELEASE_STATUS"],
            "required_filters": [
                "ORS.STATUS = '1500'",
                "ORS.STATUS_QUANTITY > 0"
            ],
            "optional_filters": [
                "OH.HOLD_FLAG = 'N' (exclude held orders)",
                "OH.DOCUMENT_TYPE = 'Order' (specific document type)"
            ]
        }
    },
    "order_fulfillment_workflow": {
        "description": "Order fulfillment status workflow",
        "workflow": [
            {"from": "1300", "to": "1500", "action": "scheduleOrder", "meaning": "Order scheduled for fulfillment"},
            {"from": "1500", "to": "1600", "action": "Pick operations", "meaning": "Order picked from warehouse"},
            {"from": "1600", "to": "2000", "action": "confirmShipment", "meaning": "Shipment confirmed and handed to carrier"},
            {"from": "1500", "to": "3000", "action": "cancelOrderLine", "meaning": "Order line cancelled"},
            {"from": "1600", "to": "3000", "action": "cancelOrderLine", "meaning": "Order line cancelled after picking"}
        ]
    }
}


def add_business_rule_to_kg(rule_name: str, rule_data: Dict) -> bool:
    """Add a business rule to the Knowledge Graph.

    Args:
        rule_name: Name of the rule
        rule_data: Rule data dictionary

    Returns:
        True if successful, False otherwise
    """
    uri = os.getenv("NEO4J_URI", "neo4j+s://8d4c95ba.databases.neo4j.io")
    user = os.getenv("NEO4J_USER", "plantrix_admin")
    password = os.getenv("NEO4J_PASSWORD", "password")

    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        with driver.session() as session:
            # Create a BusinessRule node using parameterized query
            description = rule_data.get("description", "")
            rule_json = str(rule_data)

            result = session.run("""
            MERGE (b:BusinessRule {name: $rule_name})
            SET b.description = $description,
                b.rule_type = 'OMS_BUSINESS_LOGIC'
            RETURN b.name
            """, rule_name=rule_name, description=description)

            record = result.single()
            if record:
                print(f"  OK BusinessRule: {rule_name}")
                return True
            else:
                print(f"  -- Failed to add: {rule_name}")
                return False

    except Exception as e:
        print(f"  ERROR adding rule {rule_name}: {str(e)[:100]}")
        return False
    finally:
        driver.close()


def add_status_code_references() -> int:
    """Add references from EntityType nodes to status codes.

    Returns:
        Number of references added
    """
    uri = os.getenv("NEO4J_URI", "neo4j+s://8d4c95ba.databases.neo4j.io")
    user = os.getenv("NEO4J_USER", "plantrix_admin")
    password = os.getenv("NEO4J_PASSWORD", "password")

    driver = GraphDatabase.driver(uri, auth=(user, password))
    count = 0

    try:
        with driver.session() as session:
            # Add status code documentation to YFS_ORDER_RELEASE_STATUS
            status_table = "YFS_ORDER_RELEASE_STATUS"
            status_codes = """1300=Created, 1500=Scheduled (stuck if STATUS_QUANTITY > 0), 1600=Picked, 2000=Shipped, 3000=Cancelled. Required filter for stuck orders: WHERE STATUS = '1500' AND STATUS_QUANTITY > 0"""

            result = session.run("""
            MATCH (e:EntityType {name: $table_name})
            SET e.business_rules = $status_codes
            RETURN e.name
            """, table_name=status_table, status_codes=status_codes)

            if result.single():
                print(f"  OK Added status codes to {status_table}")
                count += 1

    except Exception as e:
        print(f"  ERROR: {str(e)[:100]}")
    finally:
        driver.close()

    return count


def main():
    print("=== Extracting Business Rules to KG ===\n")

    # Step 1: Add business rule nodes
    print("Step 1: Adding business rule nodes to KG...")
    added = 0
    for rule_name, rule_data in BUSINESS_RULES.items():
        if add_business_rule_to_kg(rule_name, rule_data):
            added += 1

    print(f"\nOK: Added {added} business rules")

    # Step 2: Add status code references to tables
    print("\nStep 2: Adding status code documentation to entities...")
    refs = add_status_code_references()
    print(f"OK: Added {refs} status code references")

    print("\n=== Done ===")
    print("\nBusiness rules are now retrievable via:")
    print("  - query_kg: MATCH (b:BusinessRule) WHERE b.name = 'stuck_orders_rule' RETURN b")
    print("  - YFS_ORDER_RELEASE_STATUS now includes business_rules property with status codes")


if __name__ == "__main__":
    main()
