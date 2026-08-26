"""
Load status-related business rules into Neo4j KG.

Loads:
1. All 261 status codes from YFS_STATUS table (as StatusCode nodes)
2. 5 query pattern rules:
   - yfs_order_release_status_current_status_rule (CRITICAL table structure)
   - scheduled_orders_rule (status 1500)
   - shipped_orders_rule (status 3700)
   - held_orders_rule (status 8000)
   - released_orders_rule (status 3200+)

Usage:
    python load_status_rules.py
"""

from neo4j_client import Neo4JClient
import json
from datetime import datetime
from pathlib import Path


STATUS_RULES = [
    {
        "id": "current_status_identification",
        "name": "Current Status Identification in YFS_ORDER_RELEASE_STATUS",
        "description": "How to identify the current status of an order line in YFS_ORDER_RELEASE_STATUS",
        "rule_type": "table_structure",
        "applies_to": ["YFS_ORDER_RELEASE_STATUS"],
        "constraint": "ANY query against YFS_ORDER_RELEASE_STATUS MUST include STATUS_QUANTITY > 0",
        "business_logic": "YFS_ORDER_RELEASE_STATUS stores complete history of order line status transitions. Current status has STATUS_QUANTITY > 0, historical statuses have STATUS_QUANTITY = 0.",
        "example_correct": "WHERE STATUS = '1500' AND STATUS_QUANTITY > 0",
        "example_wrong": "WHERE STATUS = '1500'  -- Returns all historical rows",
        "priority": "CRITICAL",
        "verified": True,
        "source": "User requirement"
    },
    {
        "id": "scheduled_orders_query",
        "name": "Orders in Scheduled Status",
        "description": "Find orders currently in scheduled status",
        "rule_type": "query_pattern",
        "applies_to": ["YFS_ORDER_HEADER", "YFS_ORDER_LINE", "YFS_ORDER_RELEASE_STATUS"],
        "required_filters": [
            "ORS.STATUS = '1500'",
            "ORS.STATUS_QUANTITY > 0"
        ],
        "business_logic": "Status 1500 (Scheduled) with STATUS_QUANTITY > 0 identifies order lines currently in scheduled status.",
        "status_code": "1500",
        "status_name": "Scheduled",
        "priority": "HIGH",
        "verified": True,
        "source": "YFS_STATUS export + user validation"
    },
    {
        "id": "shipped_orders_query",
        "name": "Orders in Shipped Status",
        "description": "Find orders currently in shipped status",
        "rule_type": "query_pattern",
        "applies_to": ["YFS_ORDER_HEADER", "YFS_ORDER_RELEASE_STATUS"],
        "required_filters": [
            "ORS.STATUS = '3700'",
            "ORS.STATUS_QUANTITY > 0"
        ],
        "business_logic": "Status 3700 (Shipped) with STATUS_QUANTITY > 0 identifies orders currently in shipped state.",
        "status_code": "3700",
        "status_name": "Shipped",
        "priority": "HIGH",
        "verified": True,
        "source": "YFS_STATUS export"
    },
    {
        "id": "held_orders_query",
        "name": "Orders in Held Status",
        "description": "Find orders currently on hold",
        "rule_type": "query_pattern",
        "applies_to": ["YFS_ORDER_HEADER", "YFS_ORDER_RELEASE_STATUS"],
        "required_filters": [
            "ORS.STATUS = '8000'",
            "ORS.STATUS_QUANTITY > 0"
        ],
        "business_logic": "Status 8000 (Held) with STATUS_QUANTITY > 0 identifies orders currently on hold.",
        "status_code": "8000",
        "status_name": "Held",
        "priority": "HIGH",
        "verified": True,
        "source": "YFS_STATUS export"
    },
    {
        "id": "released_orders_query",
        "name": "Orders in Released Status",
        "description": "Find orders currently in post-release state",
        "rule_type": "query_pattern",
        "applies_to": ["YFS_ORDER_HEADER", "YFS_ORDER_RELEASE_STATUS"],
        "required_filters": [
            "ORS.STATUS >= '3200'",
            "ORS.STATUS_QUANTITY > 0"
        ],
        "business_logic": "Status 3200 (Released) or higher with STATUS_QUANTITY > 0 identifies orders currently in post-release state.",
        "status_code": "3200+",
        "status_name": "Released",
        "priority": "MEDIUM",
        "verified": True,
        "source": "YFS_STATUS export"
    }
]


def load_status_codes(neo4j_client):
    """Load all 261 status codes from status_codes_structured.json into KG."""
    print("Loading 261 status codes from YFS_STATUS table...\n")

    # Load the structured status data
    status_file = Path("status_codes_structured.json")
    if not status_file.exists():
        print(f"ERROR: {status_file} not found")
        return {"loaded": 0, "failed": 0}

    with open(status_file, 'r') as f:
        status_data = json.load(f)

    loaded_count = 0
    failed_count = 0

    # Create StatusCode nodes for each status
    for process_type, statuses in status_data.get("statuses_by_process_type", {}).items():
        for status in statuses:
            try:
                query = """
                CREATE (sc:StatusCode {
                    code: $code,
                    name: $name,
                    description: $description,
                    process_type: $process_type,
                    status_type: $status_type,
                    source: 'YFS_STATUS'
                })
                RETURN sc.code as code
                """

                params = {
                    "code": status["code"],
                    "name": status["name"],
                    "description": status["description"],
                    "process_type": status["process_type"],
                    "status_type": status.get("status_type", "")
                }

                result = neo4j_client.run_query(query, params)
                if result:
                    loaded_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                failed_count += 1
                print(f"  Error loading status {status['code']}: {str(e)[:60]}")

    print(f"Loaded {loaded_count} status codes")
    if failed_count > 0:
        print(f"Failed to load {failed_count} status codes")

    return {"loaded": loaded_count, "failed": failed_count}


def load_status_rules(neo4j_client):
    """Load all status rules into KG."""
    print("Loading 5 status query pattern rules into KG...\n")

    loaded_rules = []
    failed_rules = []

    for rule in STATUS_RULES:
        try:
            # Create BusinessRule node with all properties
            query = """
            CREATE (br:BusinessRule {
                rule_id: $rule_id,
                name: $name,
                description: $description,
                rule_type: $rule_type,
                constraint: $constraint,
                business_logic: $business_logic,
                priority: $priority,
                verified: $verified,
                source: $source,
                applies_to: $applies_to,
                created_at: $created_at
            })
            RETURN br.rule_id as id
            """

            params = {
                "rule_id": rule["id"],
                "name": rule["name"],
                "description": rule["description"],
                "rule_type": rule["rule_type"],
                "constraint": rule.get("constraint", ""),
                "business_logic": rule["business_logic"],
                "priority": rule["priority"],
                "verified": rule["verified"],
                "source": rule["source"],
                "applies_to": rule["applies_to"],
                "created_at": datetime.utcnow().isoformat()
            }

            result = neo4j_client.run_query(query, params)

            if result:
                loaded_rules.append(rule["id"])
                print(f"Loaded: {rule['name']}")

                # Create relationships to EntityType nodes
                for entity in rule["applies_to"]:
                    link_query = """
                    MATCH (br:BusinessRule {rule_id: $rule_id})
                    MATCH (et:EntityType {e_name: $entity_name})
                    MERGE (br)-[:APPLIES_TO]->(et)
                    """
                    neo4j_client.run_query(link_query, {
                        "rule_id": rule["id"],
                        "entity_name": entity
                    })

            else:
                failed_rules.append(rule["id"])
                print(f"Failed: {rule['name']}")

        except Exception as e:
            failed_rules.append(rule["id"])
            print(f"✗ Error loading {rule['name']}: {str(e)[:80]}")

    return {
        "total": len(STATUS_RULES),
        "loaded": len(loaded_rules),
        "failed": len(failed_rules),
        "loaded_rules": loaded_rules,
        "failed_rules": failed_rules
    }


def main():
    print("=== Load Status-Related Rules into KG ===\n")

    try:
        client = Neo4JClient()

        # Phase 1: Load all status codes
        print("PHASE 1: Load Status Codes")
        print("-" * 60)
        status_result = load_status_codes(client)

        print("\n" + "="*60)

        # Phase 2: Load query pattern rules
        print("\nPHASE 2: Load Query Pattern Rules")
        print("-" * 60)
        rule_result = load_status_rules(client)

        print("\n" + "="*60)
        print("LOAD SUMMARY")
        print("="*60)
        print(f"\nStatus Codes (from YFS_STATUS):")
        print(f"  Loaded: {status_result['loaded']}")
        print(f"  Failed: {status_result['failed']}")

        print(f"\nQuery Pattern Rules:")
        print(f"  Total: {rule_result['total']}")
        print(f"  Loaded: {rule_result['loaded']}")
        print(f"  Failed: {rule_result['failed']}")

        if rule_result['failed'] == 0:
            print(f"\nLoaded rules:")
            for rule_id in rule_result['loaded_rules']:
                print(f"  {rule_id}")

        print("\n" + "="*60)
        if status_result['failed'] == 0 and rule_result['failed'] == 0:
            print("All status data loaded successfully!")
        else:
            print(f"Some items failed to load")

        client.close()

    except Exception as e:
        print(f"ERROR: {str(e)}")
        print("\nMake sure Neo4j connection is configured in neo4j_client.py")


if __name__ == "__main__":
    main()
