#!/usr/bin/env python3
"""Intent-Action Validator: Ensures query actions match API capabilities"""

import re
from typing import List, Dict, Tuple, Optional

class IntentActionValidator:
    """Validates that user query actions match API capabilities"""

    # Map user query action words to Impact/Effect keyword equivalents
    ACTION_KEYWORD_MAP = {
        # DELETE actions
        'delete': ['deletes', 'removes', 'delete'],
        'remove': ['deletes', 'removes', 'delete'],
        'cancel': ['deletes', 'removes', 'cancel'],
        'drop': ['deletes', 'removes', 'delete'],

        # CREATE actions
        'create': ['creates', 'new', 'insert', 'add'],
        'add': ['creates', 'new', 'insert', 'add'],
        'insert': ['creates', 'new', 'insert', 'add'],
        'new': ['creates', 'new', 'insert', 'add'],
        'generate': ['creates', 'new', 'insert', 'add'],

        # UPDATE/MODIFY actions
        'update': ['updates', 'modifies', 'modify', 'changes'],
        'modify': ['updates', 'modifies', 'modify', 'changes'],
        'change': ['updates', 'modifies', 'modify', 'changes'],
        'adjust': ['updates', 'modifies', 'modify', 'adjust', 'changes'],
        'set': ['updates', 'modifies', 'modify', 'set', 'changes'],

        # SYNC/COMPARE actions
        'sync': ['syncs', 'compares', 'compare', 'reconcile'],
        'compare': ['syncs', 'compares', 'compare', 'reconcile'],
        'reconcile': ['syncs', 'compares', 'reconcile'],
        'match': ['syncs', 'compares', 'compare'],

        # RESERVE/ALLOCATE actions
        'reserve': ['allocates', 'reserves', 'allocate', 'reserve'],
        'allocate': ['allocates', 'reserves', 'allocate'],
        'hold': ['allocates', 'reserves', 'allocate', 'reserve'],

        # GET/RETRIEVE actions
        'get': ['retrieves', 'read', 'read-only', 'obtain'],
        'retrieve': ['retrieves', 'read', 'read-only', 'obtain'],
        'read': ['retrieves', 'read', 'read-only', 'obtain'],
        'query': ['retrieves', 'read', 'read-only', 'obtain'],
        'list': ['retrieves', 'read', 'read-only', 'obtain', 'batch-operation'],
        'fetch': ['retrieves', 'read', 'read-only', 'obtain'],

        # MANAGE actions
        'manage': ['manages', 'manage'],
    }

    # Entity keywords (what is being acted on)
    ENTITY_KEYWORDS = {
        'demand': ['demand', 'demand-state'],
        'supply': ['supply', 'supply-state'],
        'inventory': ['inventory', 'supply-state', 'demand-state'],
        'reservation': ['reservation', 'reservation-state'],
        'distribution': ['distribution', 'distribution-state'],
        'cost': ['cost', 'cost-state'],
        'audit': ['audit', 'audit-trail'],
        'activity': ['activity', 'activity-log'],
        'resource': ['resource', 'resource-state'],
    }

    def extract_user_intent(self, query: str) -> Dict[str, any]:
        """Extract action and entity from user query"""
        query_lower = query.lower()

        # Find action keyword
        detected_action = None
        for action, keywords in self.ACTION_KEYWORD_MAP.items():
            if action in query_lower:
                detected_action = action
                break

        # Find entity keyword
        detected_entity = None
        for entity, keywords in self.ENTITY_KEYWORDS.items():
            if entity in query_lower:
                detected_entity = entity
                break

        return {
            'query': query,
            'action': detected_action,
            'entity': detected_entity,
            'action_keywords_needed': self.ACTION_KEYWORD_MAP.get(detected_action, []) if detected_action else [],
            'entity_keywords_needed': self.ENTITY_KEYWORDS.get(detected_entity, []) if detected_entity else [],
        }

    def validate_api_capability(
        self,
        api_name: str,
        api_keywords: List[str],
        user_intent: Dict[str, any]
    ) -> Dict[str, any]:
        """Check if API has the required action capability"""

        action_needed = user_intent['action_keywords_needed']
        entity_needed = user_intent['entity_keywords_needed']

        # If no action specified, just check entity match
        if not action_needed:
            has_entity = any(kw in api_keywords for kw in entity_needed) if entity_needed else True
            return {
                'api_name': api_name,
                'action_match': None,  # Not required
                'entity_match': has_entity,
                'overall_match': has_entity,
                'matched_keywords': [kw for kw in api_keywords if kw in entity_needed] if entity_needed else [],
            }

        # Check action match
        has_action = any(kw in api_keywords for kw in action_needed)

        # Check entity match (if specified)
        has_entity = True
        if entity_needed:
            has_entity = any(kw in api_keywords for kw in entity_needed)

        # Overall match: must have action, should have entity
        overall_match = has_action and has_entity if entity_needed else has_action

        return {
            'api_name': api_name,
            'action_match': has_action,
            'entity_match': has_entity,
            'overall_match': overall_match,
            'matched_keywords': [kw for kw in api_keywords if kw in action_needed + entity_needed],
            'missing_action': action_needed if not has_action else [],
            'missing_entity': entity_needed if not has_entity else [],
        }

    def filter_results(
        self,
        results: List[Dict],
        user_intent: Dict[str, any]
    ) -> Tuple[List[Dict], List[Dict], str]:
        """
        Filter results to match user intent.

        Returns:
            (exact_matches, partial_matches, status_message)
        """

        exact_matches = []
        partial_matches = []
        action_mismatch = []

        for result in results:
            api_name = result.get('metadata', {}).get('api_name', '')
            keywords = result.get('metadata', {}).get('keywords', [])

            validation = self.validate_api_capability(api_name, keywords, user_intent)

            if validation['overall_match']:
                exact_matches.append({
                    **result,
                    'validation': validation,
                    'match_type': 'exact'
                })
            elif validation['action_match'] or validation['entity_match']:
                partial_matches.append({
                    **result,
                    'validation': validation,
                    'match_type': 'partial'
                })
            else:
                action_mismatch.append({
                    **result,
                    'validation': validation,
                    'match_type': 'action_mismatch'
                })

        # Generate status message
        if exact_matches:
            status = f"Found {len(exact_matches)} APIs matching '{user_intent['action']}' on {user_intent['entity']}"
        elif partial_matches:
            status = f"Found {len(partial_matches)} APIs with partial match (action or entity)"
            if exact_matches:
                status += f", plus {len(exact_matches)} exact matches"
        else:
            action = user_intent.get('action', 'requested action')
            entity = user_intent.get('entity', 'entity')
            status = f"[WARNING] NO APIS FOUND that support '{action}' on {entity}"
            if action_mismatch:
                status += f"\n  Searched {len(action_mismatch)} APIs but none match the action requirement"

        return exact_matches, partial_matches, status

    def generate_alternatives(
        self,
        unmatched_results: List[Dict],
        user_intent: Dict[str, any]
    ) -> Dict[str, any]:
        """Generate alternative suggestions when no exact match found"""

        alternatives = {
            'available_entities': {},
            'available_actions': {},
            'suggestion': None
        }

        # Group by entity
        for result in unmatched_results:
            api_name = result.get('metadata', {}).get('api_name', '')
            keywords = result.get('metadata', {}).get('keywords', [])

            for entity, entity_kws in self.ENTITY_KEYWORDS.items():
                if any(kw in keywords for kw in entity_kws):
                    if entity not in alternatives['available_entities']:
                        alternatives['available_entities'][entity] = []
                    alternatives['available_entities'][entity].append(api_name)

            # Group by action
            for action, action_kws in self.ACTION_KEYWORD_MAP.items():
                if any(kw in keywords for kw in action_kws):
                    if action not in alternatives['available_actions']:
                        alternatives['available_actions'][action] = []
                    alternatives['available_actions'][action].append(api_name)

        # Generate suggestion
        target_entity = user_intent.get('entity', '')
        target_action = user_intent.get('action', '')

        if target_entity and target_entity in alternatives['available_entities']:
            apis_for_entity = alternatives['available_entities'][target_entity]
            alternatives['suggestion'] = (
                f"No API found that can '{target_action}' on {target_entity}. "
                f"But these APIs work with {target_entity}: {', '.join(apis_for_entity)}"
            )
        elif target_action and target_action in alternatives['available_actions']:
            apis_with_action = alternatives['available_actions'][target_action]
            alternatives['suggestion'] = (
                f"No API found that can '{target_action}' on {target_entity}. "
                f"But these APIs can '{target_action}': {', '.join(apis_with_action)}"
            )
        else:
            alternatives['suggestion'] = (
                f"No APIs found matching '{target_action}' on {target_entity}. "
                f"Please check your query or contact support."
            )

        return alternatives
