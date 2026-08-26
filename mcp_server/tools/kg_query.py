"""Knowledge Graph Query Tool - Direct Neo4J queries for debugging and inspection."""

import logging
from typing import Dict, Any
from mcp.server.mcpserver import MCPServer
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from kg_layer import Neo4JClient

logger = logging.getLogger(__name__)

# Pre-built query name -> Cypher query mapping
PRE_BUILT_QUERIES = {
    "AllNodeList": """MATCH (n)
RETURN DISTINCT n.id as subject, n.entity_type as type
ORDER BY subject""",

    "TriplesConfidenceDistribution": """MATCH (source)-[rel:RELATES]->(target)
WITH toFloat(rel.confidence) as conf, COUNT(*) as cnt
WITH COLLECT({confidence: conf, count: cnt}) as distribution, SUM(cnt) as total_triples
UNWIND distribution as dist
RETURN
    dist.confidence as confidence_score,
    dist.count as triple_count,
    ROUND((dist.count * 100.0) / total_triples, 1) as percentage,
    CASE
      WHEN dist.confidence >= 0.99 THEN "VERY_HIGH"
      WHEN dist.confidence >= 0.98 THEN "HIGH"
      WHEN dist.confidence >= 0.97 THEN "MEDIUM"
      WHEN dist.confidence >= 0.95 THEN "ACCEPTABLE"
      ELSE "LOW"
    END as confidence_level
ORDER BY dist.confidence DESC""",

    "API_DB_Mapping": """MATCH (api:API)
WITH api
OPTIONAL MATCH (api)-[r1:RELATES]->(param:PARAM)
WHERE r1.type = "has_input_parameter"
OPTIONAL MATCH (param)-[r2:RELATES]->(db_node)
WHERE r2.type = "maps_to_db_column"
WITH api, param, r1.notes as param_type, db_node
WITH DISTINCT api, param, param_type, db_node
WITH api, param, param_type,
     CASE
       WHEN db_node IS NOT NULL THEN split(db_node.id, ".")[0]
       ELSE "N/A"
     END as table_with_prefix,
     CASE
       WHEN db_node IS NOT NULL THEN split(db_node.id, ".")[1]
       ELSE "N/A"
     END as column_name,
     CASE
       WHEN db_node IS NOT NULL THEN "MAPPED"
       ELSE "NO_MAPPING"
     END as mapping_status
WITH api, param, param_type, column_name, mapping_status,
     CASE
       WHEN table_with_prefix CONTAINS ":" THEN split(table_with_prefix, ":")[1]
       ELSE table_with_prefix
     END as table_name
RETURN
    api.id as api_name,
    param.id as parameter_name,
    param_type as parameter_type,
    table_name,
    column_name,
    mapping_status
ORDER BY api_name, parameter_name""",

    "Related Entities": """MATCH (table:ENTITY {id:"INVENTORY_RESERVATION"})
WITH table
MATCH (table)-[r:RELATES]->(column:COLUMN)
WHERE r.type IN ["has_attribute", "has_primary_key"]
WITH table, column, r
WHERE NOT column.id IN ["`CREATEPROGID`", "`CREATETS`", "`CREATEUSERID`", "`LOCKID`", "`MODIFYPROGID`", "`MODIFYTS`", "`MODIFYUSERID`"]
WITH table, column, r
WITH table, column,
     CASE
       WHEN r.notes IS NOT NULL THEN r.notes
       WHEN column.notes IS NOT NULL THEN column.notes
       ELSE "N/A"
     END as columnDef
OPTIONAL MATCH (otherEntity:ENTITY)-[rel:RELATES]->(column)
WHERE otherEntity.id <> table.id
WITH table, column, columnDef,
     COLLECT(DISTINCT otherEntity.id) as sharingEntities
RETURN
    table.id as entity_name,
    column.id as column_name,
    columnDef as column_definition,
    "N/A" as column_description,
    CASE
      WHEN size(sharingEntities) > 0 THEN "SHARED"
      ELSE "UNIQUE"
    END as shared_status,
    size(sharingEntities) as shared_entity_count,
    CASE
      WHEN size(sharingEntities) > 0 THEN "[" + reduce(s = "", e IN sharingEntities | s + CASE WHEN s = "" THEN e ELSE ", " + e END) + "]"
      ELSE "[]"
    END as shared_with_entities
ORDER BY column_name""",

    "Integrations": """MATCH (integration:INTEGRATIONS)
WHERE integration.id STARTS WITH 'INTERFACE_'
RETURN
    integration.id as interface_id,
    integration.interface_id as interface_code,
    integration.source_system as source_system,
    integration.target_system as target_system,
    integration.mechanism as integration_mechanism,
    integration.description as interface_description
ORDER BY integration.id""",

    "ReservationServiceFunctionalFlow": """MATCH (step:PROCESS)
WHERE step.id STARTS WITH 'STEP_'
WITH DISTINCT step,
     CASE
       WHEN step.step_number IS NOT NULL THEN toInteger(step.step_number)
       ELSE 999
     END as step_num
OPTIONAL MATCH (step)-[r:RELATES]->(next_step:PROCESS)
WHERE r.type = 'follows'
WITH DISTINCT step, step_num, next_step
RETURN
    step.id as current_step_id,
    step.step_number as step_number,
    step.description as step_description,
    step.type as step_type,
    CASE
      WHEN next_step IS NOT NULL THEN next_step.id
      ELSE "END"
    END as next_step_id,
    step_num as sort_key
ORDER BY step_num""",

    "ReservationServiceTechnicalFlow": """MATCH (comp:SYSTEM)
WHERE comp.id STARTS WITH 'COMPONENT_'
OPTIONAL MATCH (comp)-[meta_rel:RELATES]->(meta_obj)
WHERE meta_rel.type = "__METADATA"
WITH comp,
     CASE
       WHEN comp.step_number IS NOT NULL THEN toInteger(comp.step_number)
       ELSE 999
     END as step_num,
     comp.step_number as step_str,
     comp.component_name as comp_name,
     comp.component_type as comp_type,
     comp.description as comp_desc
RETURN
    step_num,
    step_str as step_number,
    comp.id as component_id,
    comp_name as component_name,
    comp_type as component_type,
    comp_desc as description
ORDER BY step_num""",

    "PolicyImpactAnalysis": """MATCH (policy:POLICY)
WHERE policy.id STARTS WITH 'POLICY_'
WITH policy,
     CASE
       WHEN policy.policy_id IS NOT NULL THEN toInteger(SUBSTRING(policy.policy_id, 8))
       ELSE 999
     END as sort_num
RETURN
    policy.id as policy_id,
    policy.trigger_condition as trigger_condition,
    policy.prescribed_action as prescribed_action,
    policy.priority as priority,
    policy.statement as policy_statement,
    sort_num as sort_key
ORDER BY sort_num""",

    "FetchAssumptions": """MATCH (assumption:SYSTEM)
WHERE assumption.id STARTS WITH 'ASSUMPTION_'
WITH assumption,
     CASE
       WHEN assumption.sno IS NOT NULL THEN toInteger(assumption.sno)
       ELSE 999
     END as sort_num
RETURN
    assumption.id as assumption_id,
    assumption.sno as sequence_number,
    assumption.assumption as assumption_statement,
    assumption.impacted_system as impacted_system,
    sort_num as sort_key
ORDER BY sort_num""",

    "Issues": """MATCH (design:ISSUES)
WHERE design.id STARTS WITH 'DESIGN_'
WITH design,
     CASE
       WHEN design.sno IS NOT NULL THEN toInteger(design.sno)
       ELSE 999
     END as sort_num
RETURN
    design.id as design_id,
    design.sno as sequence_number,
    design.issue as design_issue,
    design.owner as owner,
    design.status as status,
    design.resolution as resolution,
    sort_num as sort_key
ORDER BY sort_num""",

    "Configurations": """MATCH (config:CONFIG)
WHERE config.id STARTS WITH 'CONFIG_'
WITH config,
     CASE
       WHEN config.sno IS NOT NULL THEN toInteger(config.sno)
       ELSE 999
     END as sort_num,
     CASE
       WHEN config.id STARTS WITH 'CONFIG_EXPIRY_' THEN 'EXPIRY'
       WHEN config.id STARTS WITH 'CONFIG_PURGE_' THEN 'PURGE'
       ELSE 'OTHER'
     END as config_type
RETURN
    config.id as config_id,
    config_type as configuration_type,
    config.sno as sequence_number,
    config.field as field_name,
    config.description as field_description,
    config.attribute as attribute_name,
    config.value as attribute_value,
    sort_num as sort_key
ORDER BY config_type, sort_num""",

    "ConnectedEntitiesWithPredicates": """MATCH (inventory:ENTITY {id:"INVENTORY"})
WITH inventory
MATCH (inventory)-[rel:RELATES]->(connected)
RETURN
    inventory.id as entity,
    rel.type as predicate,
    connected.id as connected_to,
    CASE
      WHEN connected:ENTITY THEN "ENTITY"
      WHEN connected:COLUMN THEN "COLUMN"
      WHEN connected:API THEN "API"
      ELSE "OTHER"
    END as target_type""",

    "RelationshipsPerEntity": """MATCH (entity:ENTITY {id:"INVENTORY_RESERVATION"})
WITH entity
MATCH (entity)-[r:RELATES]->(column:COLUMN)
WHERE r.type IN ["has_attribute", "has_primary_key"]
WITH entity, column, r
WITH entity, column,
     CASE
       WHEN r.type = "has_primary_key" THEN "PRIMARY_KEY"
       ELSE "ATTRIBUTE"
     END as column_type,
     r.notes as column_info
OPTIONAL MATCH (otherEntity:ENTITY)-[rel:RELATES]->(column)
WHERE otherEntity.id <> entity.id
WITH entity, column, column_type, column_info,
     COLLECT(DISTINCT otherEntity.id) as shared_entities
RETURN
    entity.id as entity_name,
    column.id as column_id,
    column_type,
    column_info,
    CASE
      WHEN size(shared_entities) > 0 THEN "SHARED"
      ELSE "UNIQUE"
    END as sharing_status,
    shared_entities
ORDER BY column.id""",

    "GenericQuery": """MATCH (n:NODE)
RETURN n.id, n.entity_type
LIMIT 100""",
}


def register_kg_query_tool(mcp: FastMCP):
    """Register KG query tool for business logic queries."""

    @mcp.tool()
    def query_kg(cypher_query: str) -> Dict[str, Any]:
        """
        Execute Cypher queries against the Neo4j Knowledge Graph for inventory related entities and tables.

        The Knowledge Graph contains:
        - 1,603 nodes (COLUMN, PARAM, DB, ENTITY, API, SYSTEM, PROCESS types)
        - 3,375 relationships with 98.6% high-confidence data (56.5% VERY_HIGH, 42.1% HIGH)
        - API-to-database traceability, business rules, process flows, integration points

        STEP 1: Always call PRE-BUILT QUERIES FIRST by name to understand graph structure.
        STEP 2: Study the results to learn actual node labels and properties.
        STEP 3: Only then write custom Cypher using verified structure.

        Pre-built queries (call by name):

        1. API_DB_Mapping: Map APIs to database columns they depend on
           Use when: "Which APIs use table X?", "What columns does getOrderList access?"

        2. Related Entities: Show all columns for an entity and identify sharing patterns
           Use when: "What are all columns in INVENTORY_RESERVATION?", "Which tables share this column?"

        3. Integrations: Fetch all system integration points (3 interfaces documented)
           Use when: "What are the integration points?", "How does Order Capture talk to DOMS?"

        4. ReservationServiceFunctionalFlow: End-to-end business process (24 sequential steps)
           Use when: "Show the order-to-inventory flow", "What's the complete process?"

        5. ReservationServiceTechnicalFlow: Technical component implementation (12 components)
           Use when: "What components make this work?", "How is this technically implemented?"

        6. PolicyImpactAnalysis: Business policies (6 policies with conditions/actions)
           Use when: "What policies apply?", "When is a reservation cancelled?"

        7. FetchAssumptions: System assumptions and impact (6 documented)
           Use when: "What assumptions does the system make?", "What could break this?"

        8. Issues: Design decisions and resolutions (2 issues tracked)
           Use when: "What design issues exist?", "How were conflicts resolved?"

        9. Configurations: Configuration parameters (8 items: EXPIRY/PURGE)
           Use when: "What configuration options exist?", "How long do reservations last?"

        10. TriplesConfidenceDistribution: Data quality metrics
            Use when: "How confident is this data?", "What's the quality of the KG?"

        11. AllNodeList: All 1,603 nodes in the KG
            Use when: "What entities exist?", "Show all nodes"

        12. ConnectedEntitiesWithPredicates: Entities related to a specific node
            Use when: "What's connected to INVENTORY?", "Show relationships"

        13. RelationshipsPerEntity: Entity column details with sharing analysis
            Use when: "Detailed column breakdown for an entity"

        14. GenericQuery: Template for custom queries
            Use when: Building custom analysis

        Args:
            cypher_query: Either a pre-built query name OR custom Cypher code

                         RECOMMENDED WORKFLOW:
                         1. First, use pre-built queries to explore KG structure
                         2. Study results to understand node labels, properties, relationships
                         3. Then write informed custom Cypher queries if needed

                         Pre-built queries (14 available):
                         - API_DB_Mapping, Related Entities, Integrations
                         - ReservationServiceFunctionalFlow, ReservationServiceTechnicalFlow
                         - PolicyImpactAnalysis, FetchAssumptions, Issues, Configurations
                         - TriplesConfidenceDistribution, AllNodeList
                         - ConnectedEntitiesWithPredicates, RelationshipsPerEntity
                         - GenericQuery

                         For custom Cypher:
                         - FIRST run AllNodeList or TriplesConfidenceDistribution to understand structure
                         - THEN examine results to find correct node labels and properties
                         - THEN write custom queries using verified labels/properties from results

        Returns:
            {
              "success": bool,
              "result_count": int,
              "results": list of records,
              "error": str (if failed)
            }

        Note: Skill file with full query definitions: D:\\Tastemaker_bot\\skills\\kg_inventory_reservation_service.md
              To select pre-built queries based on intent, invoke kg_query_selection_prompt
        """
        try:
            # Check if this is a pre-built query name
            if cypher_query in PRE_BUILT_QUERIES:
                actual_cypher = PRE_BUILT_QUERIES[cypher_query]
                logger.info(f"[KG Query] Using pre-built query: {cypher_query}")
            else:
                actual_cypher = cypher_query
                logger.info(f"[KG Query] Using custom Cypher query")

            client = Neo4JClient()
            results = client.run_query(actual_cypher)
            client.close()

            return {
                "success": True,
                "result_count": len(results),
                "results": results,
            }
        except Exception as e:
            logger.error(f"[KG Query] Failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "results": [],
            }

    logger.info("[KG Query] Tool registered: query_kg")
