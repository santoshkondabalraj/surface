"""Restore KG business rules from preserved JSON files in research_artifacts."""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


def restore_kg_business_rules(archive_dir: str = "research_artifacts",
                              load_atomic: bool = True,
                              load_conditional: bool = True) -> Dict[str, Any]:
    """
    Restore Neo4J KG with business rules from preserved JSON files.

    This script loads atomic and conditional rules from the research_artifacts
    and upserts them to Neo4J, exactly replicating the original KG structure.

    Args:
        archive_dir: Path to research_artifacts folder
        load_atomic: Whether to load atomic rules (default: True)
        load_conditional: Whether to load conditional rules (default: True)

    Returns:
        Summary dict with statistics
    """
    from kg_upsert import KGUpsertManager

    # Initialize KG manager
    try:
        manager = KGUpsertManager()
    except Exception as e:
        logger.error(f"Failed to initialize KG: {e}")
        return {"success": False, "error": str(e)}

    archive_path = Path(archive_dir)
    if not archive_path.exists():
        error_msg = f"Archive directory not found: {archive_dir}"
        logger.error(error_msg)
        return {"success": False, "error": error_msg}

    stats = {
        "atomic_rules_loaded": 0,
        "conditional_rules_loaded": 0,
        "atomic_rules_upserted": 0,
        "conditional_rules_upserted": 0,
        "errors": []
    }

    # Load atomic rules
    if load_atomic:
        logger.info("Loading atomic rules...")
        atomic_files = sorted(archive_path.glob("ATOMIC_RULES_*.json"))

        for rule_file in atomic_files:
            logger.info(f"  Loading {rule_file.name}...")
            try:
                with open(rule_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                rules = data.get("atomic_rules", [])
                workstream = data.get("summary", {}).get("workstream", "Unknown")

                logger.info(f"    → {len(rules)} rules loaded for {workstream}")
                stats["atomic_rules_loaded"] += len(rules)

                # Upsert each atomic rule
                for rule in rules:
                    try:
                        success = manager.upsert_atomic_rule(
                            rule_id=rule.get("rule_id", f"ATOMIC_{rule.get('step_num', 'UNKNOWN')}"),
                            rule_name=rule.get("description", "Unnamed rule")[:100],
                            description=rule.get("description", ""),
                            rule_logic=f"{rule.get('action_type', '')}: {rule.get('action_entities', [])}",
                            workstream=rule.get("workstream", "Unknown"),
                            entities=rule.get("action_entities", [])
                        )
                        if success:
                            stats["atomic_rules_upserted"] += 1
                    except Exception as e:
                        logger.debug(f"    Error upserting rule {rule.get('rule_id')}: {e}")
                        stats["errors"].append(f"Atomic rule {rule.get('rule_id')}: {str(e)[:50]}")

            except Exception as e:
                logger.error(f"  Failed to load {rule_file.name}: {e}")
                stats["errors"].append(f"File {rule_file.name}: {str(e)[:50]}")

    # Load conditional rules
    if load_conditional:
        logger.info("Loading conditional rules...")
        conditional_files = sorted(archive_path.glob("CONDITIONAL_RULES_*.json"))

        for rule_file in conditional_files:
            logger.info(f"  Loading {rule_file.name}...")
            try:
                with open(rule_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                rules = data.get("conditional_rules", [])
                logger.info(f"    → {len(rules)} rules loaded")
                stats["conditional_rules_loaded"] += len(rules)

                # Upsert each conditional rule
                for rule in rules:
                    try:
                        actions = []
                        if rule.get("then_action_summary"):
                            actions.append(rule.get("then_action_summary", "")[:100])
                        if rule.get("else_action_summary"):
                            actions.append(f"else: {rule.get('else_action_summary', '')[:100]}")

                        success = manager.upsert_conditional_rule(
                            rule_id=rule.get("rule_id", f"COND_{rule.get('step_num', 'UNKNOWN')}"),
                            rule_name=rule.get("description", "Unnamed rule")[:100],
                            condition=rule.get("condition_summary", ""),
                            actions=actions if actions else ["no action"],
                            workstream=rule.get("workstream", "Unknown")
                        )
                        if success:
                            stats["conditional_rules_upserted"] += 1
                    except Exception as e:
                        logger.debug(f"    Error upserting rule {rule.get('rule_id')}: {e}")
                        stats["errors"].append(f"Conditional rule {rule.get('rule_id')}: {str(e)[:50]}")

            except Exception as e:
                logger.error(f"  Failed to load {rule_file.name}: {e}")
                stats["errors"].append(f"File {rule_file.name}: {str(e)[:50]}")

    # Close connection
    manager.close()

    logger.info(f"\n{'='*60}")
    logger.info(f"KG Restoration complete!")
    logger.info(f"  Atomic rules loaded: {stats['atomic_rules_loaded']}")
    logger.info(f"  Atomic rules upserted: {stats['atomic_rules_upserted']}")
    logger.info(f"  Conditional rules loaded: {stats['conditional_rules_loaded']}")
    logger.info(f"  Conditional rules upserted: {stats['conditional_rules_upserted']}")
    if stats["errors"]:
        logger.warning(f"  Errors: {len(stats['errors'])}")
        for err in stats["errors"][:5]:
            logger.warning(f"    - {err}")
        if len(stats["errors"]) > 5:
            logger.warning(f"    ... and {len(stats['errors']) - 5} more")
    logger.info(f"{'='*60}\n")

    return {
        "success": len(stats["errors"]) == 0,
        **stats
    }


if __name__ == "__main__":
    import sys
    import os

    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s - %(message)s'
    )

    # Get arguments
    archive_dir = sys.argv[1] if len(sys.argv) > 1 else "research_artifacts"
    load_atomic = "--no-atomic" not in sys.argv
    load_conditional = "--no-conditional" not in sys.argv

    print(f"""
╔════════════════════════════════════════════════════════════════╗
║           RESTORE KG BUSINESS RULES FROM ARCHIVE               ║
╚════════════════════════════════════════════════════════════════╝

Archive directory:       {archive_dir}
Load atomic rules:       {load_atomic}
Load conditional rules:  {load_conditional}

Starting restoration...
""")

    # Run restoration
    result = restore_kg_business_rules(
        archive_dir=archive_dir,
        load_atomic=load_atomic,
        load_conditional=load_conditional
    )

    # Print result
    print(f"""
{'✅' if result['success'] else '⚠️'} Restoration {'succeeded' if result['success'] else 'completed with issues'}

Summary:
  Atomic rules loaded:     {result['atomic_rules_loaded']}
  Atomic rules upserted:   {result['atomic_rules_upserted']}
  Conditional rules loaded: {result['conditional_rules_loaded']}
  Conditional rules upserted: {result['conditional_rules_upserted']}

  Total errors:            {len(result['errors'])}
""")

    if result['errors']:
        print("Errors (first 10):")
        for err in result['errors'][:10]:
            print(f"  - {err}")

    sys.exit(0 if result['success'] else 1)
