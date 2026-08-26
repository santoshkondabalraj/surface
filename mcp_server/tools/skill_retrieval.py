"""MCP tool for skill retrieval via Pinecone hybrid search."""

from typing import Any
from mcp.server.mcpserver import MCPServer
from .pinecone_skills import get_skills_manager


async def retrieve_skills(
    user_query: str,
    conversation_history: list[str] | None = None
) -> dict[str, Any]:
    """
    Retrieve relevant skills using hybrid search (lexical + semantic + domain re-ranking).

    Args:
        user_query: The user's question or request
        conversation_history: Optional list of recent conversation messages for context

    Returns:
        Structured result with domain, context guide, top skills, and re-ranking explanation
    """
    manager = get_skills_manager()
    result = await manager.hybrid_search(user_query, None, conversation_history, top_k=5)

    return {
        "domain_detected": result.domain_detected,
        "domain_confidence": result.domain_confidence,
        "context_guide": result.context_guide,
        "top_skills": result.top_skills,
        "re_ranking_applied": result.re_ranking_applied,
        "validation_status": result.validation_status,
        "alternatives": result.alternatives
    }


def register_skill_retrieval_tool(mcp: FastMCP) -> None:
    """Register the retrieve_skills tool with the MCP server."""

    @mcp.tool()
    async def retrieve_skills_tool(
        user_query: str,
        conversation_history: list[str] | None = None
    ) -> dict[str, Any]:
        """Discover Sterling OMS APIs and skills relevant to the user's request.

        ## WHEN TO USE
        Use this tool to find which API or User Exit handles a specific business domain/action:
        - "I need to create an order" → retrieve_skills_tool → returns createOrder API
        - "I need to check inventory" → retrieve_skills_tool → returns checkAvailability API
        - "I need to validate items" → retrieve_skills_tool → returns YFSBeforeCreateItem User Exit

        This is a DISCOVERY TOOL for domain exploration. Use once per domain, then cache the result.

        ## WHAT YOU'RE ASKING
        "Which APIs, User Exits, or database tables handle [this business action]?"

        ## WHAT YOU'LL GET
        - domain_detected: Business domain (e.g., "OrderManagement", "InventoryManagement")
        - domain_confidence: How confident the system is (0.0-1.0)
        - top_skills: List of 5 relevant APIs/User Exits ranked by relevance
        - context_guide: Domain-specific guidance document
        - validation_status: [WARNING] if no exact match found; [OK] if good matches
        - alternatives: Suggestions if exact API not found

        ## SUCCESS SIGNAL ✓
        "domain_confidence" >= 0.85 AND top_skills list is not empty
        First skill in top_skills has match_type: "exact"
        validation_status: "[OK]" or no [WARNING]

        ## FAILURE MODES ❌
        1. No exact match found
           validation_status: "[WARNING] NO APIS FOUND that support 'delete' on demand"
           → Fallback: Check alternatives field for related capabilities
           → Action: Ask user for clarification or propose available alternatives

        2. Domain not detected
           domain_confidence: < 0.5
           → Fallback: Refine user_query with more specific business context
           → Retry: Call retrieve_skills_tool again with clearer terms

        3. Too many results
           top_skills: 5+ items all with similar scores
           → Fallback: Use context_guide to understand domain better
           → Action: Filter results by matching your specific need

        ## COST PROFILE
        - Latency: 1.9-2.4 SECONDS [BOTTLENECK] 🚨
        - Tokens: ~800-1200 (Pinecone search + re-ranking)
        - Use ONCE per domain per conversation
        - DON'T CALL TWICE: Results are stable; cache the output
        - OPTIMIZATION: Skip this if API name is already known or provided by user

        ## DEPENDENCIES & ORDERING
        Preconditions: User must have provided a business request (not already API names)
        Typical predecessor: User input analysis (what are they asking?)
        Typical successor: get_api_schema (to explore the API fields) OR refine_api_query_with_schema
        Can be skipped if: User already knows the API name (e.g., "I need getOrderList")

        ## VALID SEQUENCES
        ✓ retrieve_skills (1.9s) → get_api_schema (0.1s) → refine (0.1s) → call_oms_api (0.4s) = ~2.5s
        ✓ retrieve_skills (1.9s) → refine (step 1+2) → call_oms_api = ~2.4s
        ✓ [Skip retrieve_skills if API name known] → refine → call_oms_api = ~0.6s ← FASTER

        ## INVALID SEQUENCES
        ❌ retrieve_skills in a loop (trying twice for same domain) = 3.8s wasted
        ❌ retrieve_skills → call_oms_api (skipped refinement/validation)
        ❌ retrieve_skills without storing result (re-querying for same API)

        ## CACHING HINT
        If you get results for "OrderManagement" domain, CACHE them.
        If user asks another question in same domain, reuse the cached API instead of calling again.
        Example: First call returns getOrderList → Second order question → Use getOrderList directly

        Args:
            user_query: The user's question or business request
                       e.g., "How many orders are in draft status?"
                       e.g., "Create a new order for customer XYZ"
            conversation_history: Recent messages for context (last 3-5 messages)
                                 Optional; improves accuracy if provided

        Returns:
            {
              "domain_detected": "OrderManagement" | "InventoryManagement" | etc.,
              "domain_confidence": 0.92,
              "context_guide": {
                "filename": "order-context-guide.md",
                "snippet": "Domain guidance text"
              },
              "top_skills": [
                {
                  "filename": "api-order-create-modify.md",
                  "domain": "OrderManagement",
                  "relevance_score": 0.94,
                  "match_type": "exact" | "partial" | "similar",
                  "api_names": ["createOrder", "modifyOrder"],
                  "why_ranked": "skill match | domain: OrderManagement | priority: normal",
                  "description": "..."
                },
                ...
              ],
              "re_ranking_applied": "semantic(0.7) + domain_boost(1.5x) + ctx_guide_boost(2.0x)",
              "validation_status": "[OK]" | "[WARNING] NO APIS FOUND that support 'X'",
              "alternatives": {"suggestion": "Available: query demand (getDemandSummary), sync demand (syncInventoryDemand)"}
            }

            ⚠️ RED STOP SIGN: If validation_status contains [WARNING], NO exact match API exists.
            Check alternatives field for what IS available. Ask user for clarification.
        """
        return await retrieve_skills(user_query, conversation_history)

    print("Registered tool: retrieve_skills")
