#!/usr/bin/env python3
"""Check what nodes are in the KG."""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from kg_layer import Neo4JClient

client = Neo4JClient()

print("=" * 80)
print("KNOWLEDGE GRAPH NODE INVENTORY")
print("=" * 80)

# All nodes by label
result = client.run_query("MATCH (n) RETURN labels(n)[0] as label, count(*) as count ORDER BY count DESC")
print("\nNODES BY LABEL:")
for row in result:
    print(f"  {row['label']:30s}: {row['count']:4d}")

# All relationships
result = client.run_query("MATCH ()-[r]->() RETURN type(r) as rel_type, count(*) as count ORDER BY count DESC")
print("\nRELATIONSHIPS BY TYPE:")
for row in result:
    print(f"  {row['rel_type']:20s}: {row['count']:4d}")

# EntityType nodes
result = client.run_query("MATCH (e:EntityType) RETURN e.name as name ORDER BY name LIMIT 20")
print("\nFIRST 20 EntityType NODES:")
for i, row in enumerate(result, 1):
    print(f"  {i:2d}. {row['name']}")

result = client.run_query("MATCH (e:EntityType) RETURN count(*) as count")
total_entities = result[0]['count'] if result else 0
print(f"\nTotal EntityType nodes: {total_entities}")

# Show sample relationships
result = client.run_query("""
MATCH (source:EntityType)-[r:RELATES_TO]->(target:EntityType)
RETURN source.name as source, target.name as target, r.column as column
LIMIT 10
""")
print("\nSAMPLE RELATIONSHIPS:")
for i, row in enumerate(result, 1):
    print(f"  {i:2d}. {row['source']} --[{row['column']}]--> {row['target']}")

total_rels = client.run_query("MATCH ()-[r:RELATES_TO]->() RETURN count(*) as count")[0]['count']
print(f"\nTotal RELATES_TO edges: {total_rels}")

print("=" * 80)

client.close()
