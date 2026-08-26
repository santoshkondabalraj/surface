"""Load Atomic (non-conditional) Rules into Neo4J Knowledge Graph."""

import json
from typing import Dict, Any, List
from pathlib import Path
import logging

from .neo4j_client import Neo4JClient

logger = logging.getLogger(__name__)


class KGAtomicRuleLoader:
    """Load atomic (non-conditional) business rules from JSON into Neo4J."""

    def __init__(self, client: Neo4JClient):
        """
        Initialize loader.

        Args:
            client: Neo4JClient instance
        """
        self.client = client

    def create_atomic_rule_constraints(self) -> bool:
        """Create uniqueness constraint on AtomicRule.rule_id."""
        query = """
        CREATE CONSTRAINT atomic_rule_id IF NOT EXISTS
        ON (a:AtomicRule) ASSERT a.rule_id IS UNIQUE;
        """
        try:
            result = self.client.run_query(query)
            logger.info("[KG] Created constraint: atomic_rule_id")
            return True
        except Exception as e:
            logger.warning(f"[KG] Constraint may already exist: {e}")
            return True

    def create_index_on_workstream(self) -> bool:
        """Create index on workstream for faster queries."""
        query = """
        CREATE INDEX atomic_rule_workstream IF NOT EXISTS
        ON (a:AtomicRule) (workstream);
        """
        try:
            result = self.client.run_query(query)
            logger.info("[KG] Created index: atomic_rule_workstream")
            return True
        except Exception as e:
            logger.warning(f"[KG] Index may already exist: {e}")
            return True

    def load_rules_from_json(
        self,
        json_file: str,
        workstream: str = "Order Capture"
    ) -> Dict[str, Any]:
        """
        Load atomic rules from JSON and create nodes in Neo4J.

        Args:
            json_file: Path to ATOMIC_RULES_ORDER_CAPTURE_FINAL.json
            workstream: Name of workstream (for metadata)

        Returns:
            Summary with counts, errors, skipped
        """
        logger.info(f"[KG] Loading atomic rules from {json_file}")

        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        rules = data.get('atomic_rules', [])
        summary = data.get('summary', {})

        logger.info(f"[KG] Loaded {len(rules)} atomic rules from JSON")

        created = 0
        failed = 0
        skipped = 0

        for i, rule_data in enumerate(rules, 1):
            try:
                # Validate rule
                if not self._validate_rule(rule_data):
                    skipped += 1
                    continue

                # Create AtomicRule node
                if self._create_node(rule_data):
                    created += 1
                else:
                    failed += 1

                if i % 50 == 0:
                    logger.info(f"[KG] Progress: {i}/{len(rules)} rules processed")

            except Exception as e:
                failed += 1
                logger.error(f"[KG] Error loading rule {rule_data.get('rule_id')}: {e}")

        logger.info(f"[KG] Atomic rule loading complete:")
        logger.info(f"     Created: {created}")
        logger.info(f"     Failed: {failed}")
        logger.info(f"     Skipped: {skipped}")

        return {
            "workstream": workstream,
            "total_rules": len(rules),
            "created": created,
            "failed": failed,
            "skipped": skipped,
            "source_summary": summary
        }

    def _validate_rule(self, rule_data: Dict) -> bool:
        """Validate rule has required fields."""
        required = ['rule_id', 'step_num', 'description']
        is_valid = all(rule_data.get(field) for field in required)
        if not is_valid:
            logger.warning(f"[KG] Invalid rule (missing required fields): {rule_data.get('rule_id')}")
        return is_valid

    def _create_node(self, rule_data: Dict) -> bool:
        """Create AtomicRule node in Neo4J."""
        query = """
        CREATE (a:AtomicRule {
            rule_id: $rule_id,
            step_num: $step_num,
            workstream: $workstream,

            description: $description,
            type: $type,
            component: $component,
            source_file: $source_file,

            action_type: $action_type,
            action_entities: $action_entities,
            execution_context: $execution_context,

            created_at: datetime(),
            node_type: 'AtomicRule'
        })
        RETURN a.rule_id as rule_id
        """

        params = {
            'rule_id': rule_data['rule_id'],
            'step_num': str(rule_data['step_num']),
            'workstream': rule_data.get('workstream', 'Order Capture'),
            'description': rule_data.get('description', ''),
            'type': rule_data.get('type', ''),
            'component': rule_data.get('component', ''),
            'source_file': rule_data.get('source_file', ''),
            'action_type': rule_data.get('action_type', 'operation'),
            'action_entities': rule_data.get('action_entities', []),
            'execution_context': rule_data.get('execution_context', 'always'),
        }

        try:
            result = self.client.run_query(query, params)
            return bool(result)
        except Exception as e:
            logger.error(f"[KG] Failed to create node {params['rule_id']}: {e}")
            return False

    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics on loaded atomic rules."""
        query = """
        MATCH (a:AtomicRule) WHERE a.workstream = "Order Capture"
        RETURN
            count(a) as total_rules,
            collect(distinct a.action_type) as action_types,
            collect(distinct a.execution_context) as execution_contexts,
            avg(length(a.action_entities)) as avg_entities_per_rule
        """

        try:
            result = self.client.run_query(query)
            if result:
                return result[0]
            return {}
        except Exception as e:
            logger.error(f"[KG] Failed to get statistics: {e}")
            return {}
