"""
Comprehensive business rules extraction from all Sterling OMS markdown files.

Extracts all 7 categories:
1. Status codes & workflows
2. Required filter patterns
3. Inventory rules
4. Pricing rules
5. Hold & release rules
6. Return & cancellation rules
7. Entity relationships & cardinality

Outputs structured JSON for manual review before KG loading.

Usage:
    python extract_all_business_rules.py
"""

import re
import os
import json
from pathlib import Path
from typing import Dict, List, Any, Set
from collections import defaultdict


SKILLS_DIR = r"D:\opt\IBM\xapidocs\ERD\.claude\skills\product_skills"


class BusinessRulesExtractor:
    """Extract business rules from Sterling markdown files."""

    def __init__(self):
        self.rules = {
            "status_codes": [],
            "query_patterns": [],
            "inventory_rules": [],
            "pricing_rules": [],
            "hold_release_rules": [],
            "return_cancellation_rules": [],
            "entity_relationships": [],
            "metadata": {
                "total_files_scanned": 0,
                "total_rules_extracted": 0,
                "files_by_category": defaultdict(list)
            }
        }

    def scan_all_files(self) -> List[tuple]:
        """Scan all markdown files in skills directory.

        Returns:
            List of (filepath, category, content) tuples
        """
        files = []
        for root, dirs, filenames in os.walk(SKILLS_DIR):
            for filename in filenames:
                if filename.endswith(".md"):
                    filepath = os.path.join(root, filename)
                    # Categorize by subdirectory
                    parts = Path(filepath).parts
                    category = parts[-2] if len(parts) > 1 else "unknown"

                    try:
                        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        files.append((filepath, category, content))
                    except Exception as e:
                        print(f"  ERROR reading {filename}: {str(e)[:50]}")

        return files

    def extract_status_codes(self, content: str, filename: str) -> List[Dict]:
        """Extract status codes and their meanings."""
        rules = []

        # Pattern 1: Direct status code definitions (1500 = Scheduled)
        pattern1 = r"['\"]?(\d{4})['\"]?\s*=\s*['\"]?([^,\n'\"]+)['\"]?"

        # Pattern 2: "Valid Values: 1300, 1500, 1600"
        pattern2 = r"Valid Values?:\s*([0-9\s,]+)"

        # Pattern 3: Status code tables
        pattern3 = r"\|\s*['\"]?(\d{4})['\"]?\s*\|\s*([A-Za-z\s]+)\s*\|"

        matches1 = re.findall(pattern1, content)
        matches2 = re.findall(pattern2, content)
        matches3 = re.findall(pattern3, content)

        seen_codes = set()

        for code, name in matches1:
            if code.isdigit() and 1000 <= int(code) <= 9999 and len(name.strip()) > 2:
                key = f"{code}_{name}"
                if key not in seen_codes:
                    rules.append({
                        "code": code,
                        "name": name.strip(),
                        "source_file": filename,
                        "context": "direct_definition"
                    })
                    seen_codes.add(key)

        for codes_str in matches2:
            for code in re.findall(r'\d{4}', codes_str):
                if code not in seen_codes:
                    rules.append({
                        "code": code,
                        "name": f"Status_{code}",
                        "source_file": filename,
                        "context": "valid_values_list"
                    })
                    seen_codes.add(code)

        for code, name in matches3:
            if code not in seen_codes and len(name.strip()) > 2:
                rules.append({
                    "code": code,
                    "name": name.strip(),
                    "source_file": filename,
                    "context": "table_definition"
                })
                seen_codes.add(code)

        return rules

    def extract_query_patterns(self, content: str, filename: str) -> List[Dict]:
        """Extract required filter patterns and query pre-conditions."""
        rules = []

        # Pattern 1: Pre-conditions/Post-conditions
        precond = re.search(r"\*\*Pre-condition[s]?:\*\*\s*(.+?)(?=\n\*\*|\n---|\Z)", content, re.DOTALL)
        postcond = re.search(r"\*\*Post-condition[s]?:\*\*\s*(.+?)(?=\n\*\*|\n---|\Z)", content, re.DOTALL)

        if precond:
            rules.append({
                "pattern_type": "pre_condition",
                "condition": precond.group(1).strip()[:200],
                "source_file": filename
            })

        if postcond:
            rules.append({
                "pattern_type": "post_condition",
                "condition": postcond.group(1).strip()[:200],
                "source_file": filename
            })

        # Pattern 2: WHERE clause requirements
        where_patterns = re.findall(r"WHERE\s+([^;\n]+)", content, re.IGNORECASE)
        for pattern in where_patterns[:3]:  # Limit to 3 per file
            rules.append({
                "pattern_type": "where_clause",
                "filter": pattern.strip()[:150],
                "source_file": filename
            })

        # Pattern 3: Required/Must/Should statements
        must_patterns = re.findall(r"(?:MUST|REQUIRED|MANDATORY|SHOULD)\s+([^.\n]+)", content, re.IGNORECASE)
        for pattern in must_patterns[:3]:
            rules.append({
                "pattern_type": "requirement",
                "requirement": pattern.strip()[:150],
                "source_file": filename
            })

        return rules

    def extract_inventory_rules(self, content: str, filename: str) -> List[Dict]:
        """Extract inventory management rules."""
        rules = []

        # ATP logic
        if "atp" in content.lower() or "available to promise" in content.lower():
            rules.append({
                "rule_type": "atp_logic",
                "applies_to": "YFS_INVENTORY_SUPPLY",
                "topic": "Available-to-Promise calculation",
                "source_file": filename
            })

        # Reservation rules
        if "reserv" in content.lower():
            rules.append({
                "rule_type": "reservation",
                "applies_to": "YFS_INVENTORY_RESERVATION",
                "topic": "Inventory reservation rules",
                "source_file": filename
            })

        # Allocation rules
        if "allocat" in content.lower():
            rules.append({
                "rule_type": "allocation",
                "applies_to": "YFS_ALLOCATION_RULE",
                "topic": "Inventory distribution allocation",
                "source_file": filename
            })

        # Safety stock
        if "safety" in content.lower() or "reorder" in content.lower():
            rules.append({
                "rule_type": "safety_stock",
                "applies_to": "YFS_INVENTORY_SUPPLY",
                "topic": "Safety stock and reorder points",
                "source_file": filename
            })

        # Demand/supply matching
        if "demand" in content.lower() and "supply" in content.lower():
            rules.append({
                "rule_type": "demand_supply_matching",
                "applies_to": "YFS_INVENTORY_DEMAND,YFS_INVENTORY_SUPPLY",
                "topic": "Demand and supply matching logic",
                "source_file": filename
            })

        return rules

    def extract_pricing_rules(self, content: str, filename: str) -> List[Dict]:
        """Extract pricing and promotion rules."""
        rules = []

        if "pric" not in content.lower():
            return rules

        # Price programs
        if "price program" in content.lower():
            rules.append({
                "rule_type": "price_program",
                "applies_to": "YFS_PRICE_PROGRAM",
                "topic": "Price program logic and application",
                "source_file": filename
            })

        # Promotions
        if "promot" in content.lower():
            rules.append({
                "rule_type": "promotion",
                "applies_to": "YFS_PRICE_PROGRAM,YFS_ITEM",
                "topic": "Promotion eligibility and discount calculation",
                "source_file": filename
            })

        # Discounts
        if "discount" in content.lower():
            rules.append({
                "rule_type": "discount",
                "applies_to": "YFS_PRICE_PROGRAM",
                "topic": "Discount calculation rules",
                "source_file": filename
            })

        # Tax
        if "tax" in content.lower():
            rules.append({
                "rule_type": "tax",
                "applies_to": "YFS_ORDER_HEADER",
                "topic": "Tax calculation and rules",
                "source_file": filename
            })

        return rules

    def extract_hold_release_rules(self, content: str, filename: str) -> List[Dict]:
        """Extract hold and release rules."""
        rules = []

        if "hold" not in content.lower():
            return rules

        # Hold types
        hold_types = re.findall(r"(?:hold[_\s]?type|HoldType)\s*[:=]\s*['\"]?([A-Z_]+)['\"]?", content, re.IGNORECASE)
        for hold_type in set(hold_types):
            rules.append({
                "rule_type": "hold_type",
                "hold_type": hold_type,
                "applies_to": "YFS_ORDER_HOLD_TYPE",
                "source_file": filename
            })

        # Release conditions
        if "release" in content.lower():
            release_contexts = re.findall(r"release[^.\n]*?(?:when|if|condition)[^.\n]*", content, re.IGNORECASE)
            for context in release_contexts[:2]:
                rules.append({
                    "rule_type": "release_condition",
                    "condition_text": context.strip()[:150],
                    "applies_to": "YFS_ORDER_HOLD_TYPE",
                    "source_file": filename
                })

        return rules

    def extract_return_cancellation_rules(self, content: str, filename: str) -> List[Dict]:
        """Extract return and cancellation rules."""
        rules = []

        # Return window
        if "return" in content.lower():
            windows = re.findall(r"(\d+)\s*(?:days?|hours?)\s*(?:return|window)", content, re.IGNORECASE)
            if windows:
                rules.append({
                    "rule_type": "return_window",
                    "days": windows[0],
                    "applies_to": "YFS_RETURN_ORDER",
                    "topic": "Return eligibility window",
                    "source_file": filename
                })

            # Refund rules
            if "refund" in content.lower():
                rules.append({
                    "rule_type": "refund_policy",
                    "applies_to": "YFS_RETURN_ORDER",
                    "topic": "Refund calculation and eligibility",
                    "source_file": filename
                })

        # Cancellation
        if "cancel" in content.lower():
            rules.append({
                "rule_type": "cancellation",
                "applies_to": "YFS_ORDER_HEADER,YFS_ORDER_LINE",
                "topic": "Order cancellation eligibility and rules",
                "source_file": filename
            })

        return rules

    def extract_entity_relationships(self, content: str, filename: str) -> List[Dict]:
        """Extract entity relationships and cardinality."""
        rules = []

        # FK patterns
        fk_pattern = r"FK\s*->\s*([A-Za-z0-9_]+)"
        fks = re.findall(fk_pattern, content)

        for fk in set(fks):
            rules.append({
                "relationship_type": "foreign_key",
                "target_table": fk,
                "source_file": filename,
                "cardinality": "unknown"
            })

        # Cardinality patterns
        cardinality_pattern = r"\(([1N]:?[1N])\)"
        cardinalities = re.findall(cardinality_pattern, content)

        for card in cardinalities:
            rules.append({
                "relationship_type": "cardinality",
                "cardinality": card,
                "source_file": filename
            })

        return rules

    def extract_all(self) -> Dict:
        """Extract all business rules from all files."""
        print("Scanning all markdown files...")
        files = self.scan_all_files()
        print(f"Found {len(files)} markdown files\n")

        self.rules["metadata"]["total_files_scanned"] = len(files)

        for filepath, category, content in files:
            filename = os.path.basename(filepath)

            # Extract each category
            self.rules["status_codes"].extend(self.extract_status_codes(content, filename))
            self.rules["query_patterns"].extend(self.extract_query_patterns(content, filename))
            self.rules["inventory_rules"].extend(self.extract_inventory_rules(content, filename))
            self.rules["pricing_rules"].extend(self.extract_pricing_rules(content, filename))
            self.rules["hold_release_rules"].extend(self.extract_hold_release_rules(content, filename))
            self.rules["return_cancellation_rules"].extend(self.extract_return_cancellation_rules(content, filename))
            self.rules["entity_relationships"].extend(self.extract_entity_relationships(content, filename))

            self.rules["metadata"]["files_by_category"][category].append(filename)

        # Count totals
        total_rules = sum(
            len(self.rules[key]) for key in self.rules if key != "metadata"
        )
        self.rules["metadata"]["total_rules_extracted"] = total_rules

        return self.rules


def main():
    print("=== Comprehensive Business Rules Extraction ===\n")

    extractor = BusinessRulesExtractor()
    rules = extractor.extract_all()

    # Summary
    print(f"\nExtraction Summary:")
    print(f"  Files scanned: {rules['metadata']['total_files_scanned']}")
    print(f"  Rules extracted: {rules['metadata']['total_rules_extracted']}")
    print(f"\nBy category:")
    print(f"  Status codes: {len(rules['status_codes'])}")
    print(f"  Query patterns: {len(rules['query_patterns'])}")
    print(f"  Inventory rules: {len(rules['inventory_rules'])}")
    print(f"  Pricing rules: {len(rules['pricing_rules'])}")
    print(f"  Hold/Release rules: {len(rules['hold_release_rules'])}")
    print(f"  Return/Cancellation rules: {len(rules['return_cancellation_rules'])}")
    print(f"  Entity relationships: {len(rules['entity_relationships'])}")

    # Write to review file
    review_file = "BUSINESS_RULES_EXTRACTION_REVIEW.json"
    with open(review_file, 'w', encoding='utf-8') as f:
        json.dump(rules, f, indent=2)

    print(f"\nOK: Extraction complete!")
    print(f"OK: Review file created: {review_file}")
    print(f"\nNext steps:")
    print(f"  1. Open {review_file} for review")
    print(f"  2. Approve, modify, or remove rules as needed")
    print(f"  3. Run: python extract_all_business_rules.py --load-approved")


if __name__ == "__main__":
    main()
