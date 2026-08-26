"""Load Conditional Rules into Neo4J Knowledge Graph."""

import json
from typing import Dict, Any, List
from pathlib import Path
import logging

from .neo4j_client import Neo4JClient

logger = logging.getLogger(__name__)


class KGConditionalRuleLoader:
    """Load conditional (IF/THEN/ELSE) business rules from JSON into Neo4J."""

    def __init__(self, client: Neo4JClient):
        """
        Initialize loader.

        Args:
            client: Neo4JClient instance
        """
        self.client = client

    def create_conditional_rule_constraints(self) -> bool:
        """Create uniqueness constraint on ConditionalRule.rule_id."""
        # Try new syntax first (Neo4j 5.x+), then old syntax (Neo4j 4.x)
        queries = [
            "CREATE CONSTRAINT conditional_rule_id IF NOT EXISTS FOR (c:ConditionalRule) REQUIRE c.rule_id IS UNIQUE;",
            "CREATE CONSTRAINT conditional_rule_id IF NOT EXISTS ON (c:ConditionalRule) ASSERT c.rule_id IS UNIQUE;"
        ]
        for query in queries:
            try:
                self.client.run_query(query)
                logger.info("[KG] Created constraint: conditional_rule_id")
                return True
            except Exception as e:
                continue
        logger.warning("[KG] Constraint may already exist or version mismatch")
        return True

    def create_index_on_workstream(self) -> bool:
        """Create index on workstream for faster queries."""
        queries = [
            "CREATE INDEX conditional_rule_workstream IF NOT EXISTS FOR (c:ConditionalRule) ON (c.workstream);",
            "CREATE INDEX conditional_rule_workstream IF NOT EXISTS ON (c:ConditionalRule) (c.workstream);"
        ]
        for query in queries:
            try:
                self.client.run_query(query)
                logger.info("[KG] Created index: conditional_rule_workstream")
                return True
            except Exception as e:
                continue
        logger.warning("[KG] Index may already exist or version mismatch")
        return True

    def load_rules_from_json(
        self,
        json_file: str,
        workstream: str = "Order Capture"
    ) -> Dict[str, Any]:
        """
        Load conditional rules from JSON and create nodes in Neo4J.

        Args:
            json_file: Path to CONDITIONAL_RULES_COMBINED_EXPLICIT_IMPLICIT_ORDER_CAPTURE.json
            workstream: Name of workstream (for metadata)

        Returns:
            Summary with counts, errors, skipped
        """
        logger.info(f"[KG] Loading conditional rules from {json_file}")

        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        rules = data.get('conditional_rules', [])
        summary = data.get('summary', {})

        logger.info(f"[KG] Loaded {len(rules)} conditional rules from JSON")

        created = 0
        failed = 0
        skipped = 0

        for i, rule_data in enumerate(rules, 1):
            try:
                # Validate rule
                if not self._validate_rule(rule_data):
                    skipped += 1
                    continue

                # Add workstream to rule data
                rule_data['workstream'] = workstream

                # Create ConditionalRule node
                if self._create_node(rule_data):
                    created += 1
                else:
                    failed += 1

                if i % 10 == 0:
                    logger.info(f"[KG] Progress: {i}/{len(rules)} rules processed")

            except Exception as e:
                failed += 1
                logger.error(f"[KG] Error loading rule {rule_data.get('rule_id')}: {e}")

        logger.info(f"[KG] Conditional rule loading complete:")
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
        # Only rule_id and then_action_type are truly required
        required = ['rule_id', 'then_action_type']
        is_valid = all(rule_data.get(field) for field in required)
        if not is_valid:
            logger.warning(f"[KG] Invalid rule (missing required fields): {rule_data.get('rule_id')}")
        return is_valid

    def _create_node(self, rule_data: Dict) -> bool:
        """Create ConditionalRule node in Neo4J."""
        import json

        query = """
        CREATE (c:ConditionalRule {
            rule_id: $rule_id,
            step_num: $step_num,
            workstream: $workstream,

            condition_summary: $condition_summary,
            condition_variables: $condition_variables,
            condition_keywords: $condition_keywords,

            then_action_summary: $then_action_summary,
            then_action_type: $then_action_type,
            then_action_details: $then_action_details,

            else_action_summary: $else_action_summary,
            else_action_type: $else_action_type,

            confidence: $confidence,
            extraction_source: $extraction_source,
            rule_type: $rule_type,
            source_file: $source_file,

            created_at: datetime(),
            node_type: 'ConditionalRule'
        })
        RETURN c.rule_id as rule_id
        """

        params = {
            'rule_id': rule_data['rule_id'],
            'step_num': str(rule_data['step_num']),
            'workstream': rule_data.get('workstream', 'Order Capture'),
            'condition_summary': rule_data.get('condition_summary', ''),
            'condition_variables': rule_data.get('condition_variables', []),
            'condition_keywords': rule_data.get('condition_keywords', []),
            'then_action_summary': rule_data.get('then_action_summary', ''),
            'then_action_type': rule_data.get('then_action_type', ''),
            'then_action_details': json.dumps(rule_data.get('then_action_details', {})),  # Convert to JSON string
            'else_action_summary': rule_data.get('else_action_summary'),
            'else_action_type': rule_data.get('else_action_type'),
            'confidence': float(rule_data.get('confidence', 0.75)),
            'extraction_source': rule_data.get('extraction_source', 'unknown'),
            'rule_type': rule_data.get('rule_type', 'conditional'),
            'source_file': rule_data.get('source_file', ''),
        }

        try:
            result = self.client.run_query(query, params)
            return bool(result)
        except Exception as e:
            logger.error(f"[KG] Failed to create node {params['rule_id']}: {e}")
            return False

    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics on loaded conditional rules."""
        query = """
        MATCH (c:ConditionalRule) WHERE c.workstream = "Order Capture"
        RETURN
            count(c) as total_rules,
            count(CASE WHEN c.confidence >= 0.9 THEN 1 END) as high_confidence,
            count(CASE WHEN c.confidence < 0.9 THEN 1 END) as medium_confidence,
            collect(distinct c.then_action_type) as action_types,
            avg(c.confidence) as avg_confidence
        """

        try:
            result = self.client.run_query(query)
            if result:
                return result[0]
            return {}
        except Exception as e:
            logger.error(f"[KG] Failed to get statistics: {e}")
            return {}
