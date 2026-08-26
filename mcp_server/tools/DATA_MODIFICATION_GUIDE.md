# Data Modification Guide — KG & Pinecone Upserts

This guide explains how to modify and update data in the Knowledge Graph (Neo4J) and Pinecone vector database using the provided upsert scripts.

---

## Overview

Three scripts handle data modification:

1. **`kg_upsert.py`** — Upsert entities, rules, and relationships into Neo4J
2. **`pinecone_upsert.py`** — Upsert skill chunks into Pinecone
3. **`ingest_skills.py`** — Chunk markdown files and ingest into both systems

---

## 1. Restore KG from Archive (`restore_kg_from_archive.py`)

### Quick Restoration

To restore the KG with all business rules from preserved JSON files:

```bash
python mcp_server/tools/restore_kg_from_archive.py
```

This script:
1. Loads all atomic rules from `ATOMIC_RULES_*.json` files
2. Loads all conditional rules from `CONDITIONAL_RULES_*.json` files
3. Upserts them to Neo4J

**Options:**

```bash
# Only load atomic rules
python mcp_server/tools/restore_kg_from_archive.py --no-conditional

# Only load conditional rules
python mcp_server/tools/restore_kg_from_archive.py --no-atomic

# Restore from custom archive location
python mcp_server/tools/restore_kg_from_archive.py /path/to/archive
```

### Python Usage

```python
from mcp_server.tools.restore_kg_from_archive import restore_kg_business_rules

result = restore_kg_business_rules(
    archive_dir="research_artifacts",
    load_atomic=True,
    load_conditional=True
)

print(f"Atomic rules upserted: {result['atomic_rules_upserted']}")
print(f"Conditional rules upserted: {result['conditional_rules_upserted']}")
print(f"Success: {result['success']}")
```

### Preserved Rules Statistics

The archive contains all business rules extracted from Sterling OMS documentation:

**Atomic Rules:**
- Order Capture: 149 rules
- Order Fulfillment: 177 rules
- Order Management: 93 rules
- Payment Processing: 86 rules
- Product Sourcing: 45 rules
- Returns & Exchanges: 154 rules
- **Total: ~700 atomic rules**

**Conditional Rules:**
- Order Capture: 33 rules
- Order Fulfillment: 5 rules
- Order Management: 2 rules
- Payment Processing: 1 rule
- Product Sourcing: 1 rule
- Returns & Exchanges: 1 rule
- **Total: ~43 conditional rules**

**Files in archive:**
- `ATOMIC_RULES_*.json` — One per workstream
- `ATOMIC_RULES_KNOWLEDGE_BASE_FINAL.json` — All atomic rules combined
- `CONDITIONAL_RULES_*.json` — One per workstream

---

## 2. Knowledge Graph Updates (`kg_upsert.py`)

### Upsert an Entity

```python
from mcp_server.tools.kg_upsert import KGUpsertManager

manager = KGUpsertManager()

# Add a new entity type
manager.upsert_entity(
    entity_name="CUSTOM_ORDER",
    entity_type="transactional",
    metadata={
        "description": "Custom order with special handling",
        "primary_key": "ORDER_ID",
    }
)

manager.close()
```

### Upsert an Atomic Rule

```python
manager.upsert_atomic_rule(
    rule_id="BR999",
    rule_name="Custom Business Rule",
    description="Check payment status before release",
    rule_logic="IF order.status = 'PENDING' AND payment.status = 'AUTHORIZED' THEN release_order()",
    workstream="Order Capture",
    entities=["ORDER", "PAYMENT"]
)
```

### Upsert a Conditional Rule

```python
manager.upsert_conditional_rule(
    rule_id="CR999",
    rule_name="Exception Escalation",
    condition="IF order.exception_count > 3",
    actions=["escalate_to_manager", "send_notification"],
    workstream="Order Management"
)
```

### Upsert a Relationship

```python
manager.upsert_relationship(
    source_entity="ORDER",
    target_entity="CUSTOM_ORDER",
    relationship_name="EXTENDS",
    cardinality="1:1"
)
```

### Delete Operations

```python
# Delete an entity
manager.delete_entity("CUSTOM_ORDER")

# Delete a rule
manager.delete_rule("BR999")
```

---

## 3. Pinecone Updates (`pinecone_upsert.py`)

### Upsert a Single Chunk

```python
from mcp_server.tools.pinecone_upsert import PineconeUpsertManager

manager = PineconeUpsertManager(
    index_name="oms-skills-hybrid",
    namespace="production"
)

chunk = {
    "chunk_id": "skill-demo-001",
    "skill_name": "demo.md",
    "chunk_index": 0,
    "chunk_type": "definition",
    "workstreams": ["Order Capture"],
    "api_names": ["demoAPI"],
    "ue_patterns": ["OC-001"],
    "db_tables": ["YFS_ORDER_HEADER"],
    "keywords": ["demo", "order"],
    "content": "This is the chunk content..."
}

manager.upsert_chunk(chunk)
```

### Upsert Multiple Chunks (Batch)

```python
chunks = [
    # ... list of chunk dicts
]

success_count = manager.upsert_chunks_batch(chunks, batch_size=100)
print(f"Upserted {success_count} chunks")
```

### Upsert from JSON File

```python
# Load and upsert chunks from JSON
count = manager.upsert_from_json("mcp_server/data/skill_chunks_order_capture.json")
print(f"Upserted {count} chunks")
```

### Delete Operations

```python
# Delete a single chunk
manager.delete_chunk("skill-demo-001")

# Delete all chunks from a skill
manager.delete_chunks_by_skill("order-capture.md")

# Delete all chunks in a workstream
manager.delete_chunks_by_workstream("Order Capture")
```

---

## 4. Restore Pinecone Index from Archive (`restore_pinecone_from_archive.py`)

### Quick Restoration

To restore the Pinecone index from preserved chunks:

```bash
python mcp_server/tools/restore_pinecone_from_archive.py
```

This script:
1. Loads all 2,234 chunks from `research_artifacts/data_analysis/`
2. Bulk upserts to Pinecone (default: production namespace)
3. Reports success/failure

**Options:**

```bash
# Restore to custom namespace (e.g., staging)
python mcp_server/tools/restore_pinecone_from_archive.py \
  research_artifacts/data_analysis staging

# Restore to custom index
python mcp_server/tools/restore_pinecone_from_archive.py \
  research_artifacts/data_analysis production oms-skills-hybrid-v2
```

### Python Usage

```python
from mcp_server.tools.restore_pinecone_from_archive import restore_pinecone_index

result = restore_pinecone_index(
    archive_dir="research_artifacts/data_analysis",
    target_namespace="staging",
    batch_size=100
)

print(f"Total upserted: {result['total_upserted']}")
print(f"Success: {result['success']}")
```

### Preserved Chunks Statistics

The archive contains the **exact chunks used to build the current index**:

- **Total chunks:** 2,234
- **Chunk types:** content, business_rules, api_reference, parameters, error_handling, overview, examples
- **Size distribution:** 0.1 KB - 182 KB (avg 7.6 KB)
- **Workstreams:** Order Capture, Order Fulfillment, Order Management, Payment Processing, Product Sourcing, Returns & Exchanges

**Files in archive:**
- `skill_chunks_ingestion_ready.json` — All 2,234 chunks combined
- `skill_chunks_order_capture.json` — Order Capture chunks
- `skill_chunks_order_fulfillment.json` — Order Fulfillment chunks
- ... (one per workstream)

---

## 5. Skill Ingestion (`ingest_skills.py`)

### When to Use

Only use this if you're **adding new markdown files** to the 6 workstreams and want to chunk them.

### ⚠️ Important: Header-Based Chunking (Different from Original)

This script uses **simple header-based chunking** (not the original semantic strategy):

1. Split by H2 headers (## Section)
2. Split by H3 subsections if too large
3. Merge small chunks

**Limitation:** Produces different chunk boundaries than the original semantic strategy.

**Recommendation:** Only use for incremental updates. For full index reconstruction, use `restore_pinecone_from_archive.py` instead.

### Adding New Content to a Workstream

```python
from mcp_server.tools.ingest_skills import SkillIngestionPipeline
from mcp_server.tools.pinecone_upsert import PineconeUpsertManager

# 1. Add new markdown files to:
#    D:\opt\IBM\xapidocs\ERD\.claude\skills\[WORKSTREAM] 1-Order Capture

# 2. Ingest new files
pipeline = SkillIngestionPipeline(
    pinecone_manager=PineconeUpsertManager(namespace="staging")
)

chunks_added = pipeline.ingest_workstream(
    r"D:\opt\IBM\xapidocs\ERD\.claude\skills\[WORKSTREAM] 1-Order Capture",
    "Order Capture"
)

# 3. Review before merging to production
print(f"Added {chunks_added} new chunks")
```

---

## 6. Full Workflow: Update & Sync

### Scenario: Update business rules after policy change

```python
from mcp_server.tools.kg_upsert import KGUpsertManager

manager = KGUpsertManager()

# 1. Delete old rule
manager.delete_rule("BR001")

# 2. Add new rule with updated logic
manager.upsert_atomic_rule(
    rule_id="BR001",
    rule_name="Payment Authorization Required (v2)",
    description="Payment must be AUTHORIZED before order release (updated threshold)",
    rule_logic="IF order.status = 'PENDING' AND payment.status = 'AUTHORIZED' AND payment.amount >= order.total THEN release_order()",
    workstream="Order Capture",
    entities=["ORDER", "PAYMENT"]
)

manager.close()
print("✅ Rule updated")
```

### Scenario: Add new skill documentation

```python
from mcp_server.tools.ingest_skills import SkillIngestionPipeline
from mcp_server.tools.pinecone_upsert import PineconeUpsertManager

# Ingest new skill files
pipeline = SkillIngestionPipeline(
    pinecone_manager=PineconeUpsertManager()
)

# Ingest from workstream
chunks_added = pipeline.ingest_workstream(
    r"D:\opt\IBM\xapidocs\ERD\.claude\skills\[WORKSTREAM] 1-Order Capture",
    "Order Capture"
)

# Save as fallback
pipeline.save_chunks_to_json(
    "mcp_server/data/skill_chunks_order_capture.json"
)

print(f"✅ Added {chunks_added} new chunks")
```

---

## 7. API Reference

### KGUpsertManager

```python
class KGUpsertManager:
    # Upserts
    upsert_entity(entity_name, entity_type, metadata) → bool
    upsert_atomic_rule(rule_id, rule_name, description, rule_logic, workstream, entities) → bool
    upsert_conditional_rule(rule_id, rule_name, condition, actions, workstream) → bool
    upsert_relationship(source_entity, target_entity, relationship_name, cardinality) → bool
    
    # Deletes
    delete_entity(entity_name) → bool
    delete_rule(rule_id) → bool
    
    # Lifecycle
    close() → None
```

### PineconeUpsertManager

```python
class PineconeUpsertManager:
    # Upserts
    upsert_chunk(chunk) → bool
    upsert_chunks_batch(chunks, batch_size=100) → int
    upsert_from_json(json_file) → int
    
    # Deletes
    delete_chunk(chunk_id) → bool
    delete_chunks_by_skill(skill_name) → int
    delete_chunks_by_workstream(workstream) → int
```

### SkillIngestionPipeline

```python
class SkillIngestionPipeline:
    ingest_workstream(workstream_dir, workstream_name) → int
    save_chunks_to_json(output_file) → bool
    get_summary() → Dict[str, Any]
```

---

## 8. Error Handling

All scripts log to Python's `logging` module. Enable logging to see details:

```python
import logging

logging.basicConfig(level=logging.INFO)

# Then run your upsert operations
manager = KGUpsertManager()
manager.upsert_entity("ORDER", "transactional", {...})
```

**Common errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection refused` | Neo4J not running | Start Neo4J: `docker-compose up neo4j` |
| `PINECONE_API_KEY not set` | Missing env var | Add to `.env` and reload |
| `ModuleNotFoundError` | Module not imported | Check `sys.path.insert` at top of script |
| `UnicodeDecodeError` | File encoding mismatch | Ensure UTF-8 encoding |

---

## 9. Best Practices

✅ **Do:**
- Test upserts in a dev namespace first: `PineconeUpsertManager(namespace="dev")`
- Batch upserts for large datasets
- Log all operations for audit trail
- Close KG connection when done: `manager.close()`
- Backup JSON fallback after ingestion

❌ **Don't:**
- Delete entities with active relationships without cleanup
- Upsert duplicate chunk IDs (will overwrite)
- Run ingestion on production without backup
- Modify schema without versioning in YAML

---

## 10. Running as Scripts

### Standalone execution:

```bash
# Ingest Order Capture workstream
python mcp_server/tools/ingest_skills.py

# The script will:
# 1. Chunk all markdown files
# 2. Save to mcp_server/data/skill_chunks_order_capture_new.json
# 3. Upsert to Pinecone (if credentials available)
```

### As MCP Tool:

You could expose these as MCP tools for Claude to call:

```python
@mcp.tool()
def upsert_kg_rule(rule_id: str, rule_name: str, ...) -> str:
    """Upsert a business rule to the Knowledge Graph."""
    manager = KGUpsertManager()
    success = manager.upsert_atomic_rule(...)
    manager.close()
    return "Rule upserted" if success else "Failed"
```

---

## Questions?

Check logs for detailed error messages:
```bash
tail -f /tmp/tastemaker_ingest.log
```

Verify your data in the systems:
- **Neo4J**: http://localhost:7474 (browser)
- **Pinecone**: https://app.pinecone.io (dashboard)
