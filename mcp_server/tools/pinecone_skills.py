"""Pinecone-based hybrid skill retrieval with workstream-aware chunking."""

import os
import json
import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Any
import google.generativeai as genai
from pinecone import Pinecone
from .intent_action_validator import IntentActionValidator

# Suppress google-generativeai deprecation warning
warnings.filterwarnings("ignore", category=FutureWarning)

@dataclass
class SkillRetrievalResult:
    """Result from hybrid skill retrieval."""
    domain_detected: str
    domain_confidence: float
    context_guide: Optional[Dict[str, str]]
    top_skills: List[Dict[str, Any]]
    re_ranking_applied: str
    validation_status: str = ""
    alternatives: Optional[Dict[str, Any]] = None


class PineconeSkillsManager:
    """Manages Pinecone index for hybrid skill retrieval with workstream-aware chunking."""

    WORKSTREAMS = [
        "Order Capture",
        "Order Fulfillment",
        "Order Management",
        "Payment Processing",
        "Product Sourcing",
        "Returns & Exchanges",
        "Inventory Management"
    ]

    WORKSTREAM_KEYWORDS = {
        "Order Capture": [
            "order", "capture", "creation", "rtam", "reservation", "carrier",
            "pre-order", "hold", "hold placement", "validation", "credit",
            "credit check", "entering"
        ],
        "Order Fulfillment": [
            "fulfillment", "fulfilling", "delivery", "release", "packing",
            "drop-ship", "warehouse", "dispatch", "pick", "pack"
        ],
        "Order Management": [
            "order management", "tracking", "enquiry", "modify", "validate",
            "order status", "order details", "order line", "change order", "cancel",
            "order", "sales order", "query order"
        ],
        "Payment Processing": [
            "payment", "fraud", "check", "capture", "fraud check", "fraud validation",
            "fraud checking", "collection", "credit card", "authorize"
        ],
        "Product Sourcing": [
            "sourcing", "vendor", "supplier", "purchase", "procurement"
        ],
        "Inventory Management": [
            "inventory", "availability", "available", "stock", "supply", "onhand",
            "on-hand", "reservation", "reserve", "allocation", "atp", "available to promise",
            "sku", "quantity", "shipnode", "fulfillment location"
        ],
        "Returns & Exchanges": [
            "returns", "exchanges", "return", "exchange", "rma", "return management"
        ],
        "Inventory Management": [
            "inventory", "availability", "available", "stock", "supply", "onhand",
            "on-hand", "reservation", "reserve", "allocation", "atp", "available to promise",
            "sku", "quantity", "shipnode", "fulfillment location"
        ],
    }

    # Workstream relationships for fallback search
    RELATED_WORKSTREAMS = {
        "Order Capture": ["Order Capture", "Order Management"],
        "Order Fulfillment": ["Order Fulfillment", "Order Management"],
        "Order Management": ["Order Management", "Order Capture", "Order Fulfillment"],
        "Payment Processing": ["Payment Processing"],
        "Product Sourcing": ["Product Sourcing", "Inventory Management"],
        "Returns & Exchanges": ["Returns & Exchanges"],
        "Inventory Management": ["Inventory Management", "Product Sourcing", "Order Fulfillment"],
    }

    def __init__(self):
        """Initialize Pinecone client and Google Generative AI."""
        self.pinecone_api_key = os.getenv("PINECONE_API_KEY", "")
        self.pinecone_index_name = os.getenv("PINECONE_INDEX_NAME", "oms-skills-hybrid")
        self.pinecone_namespace = os.getenv("PINECONE_NAMESPACE", "tastemaker-bot")
        self.google_api_key = os.getenv("GOOGLE_API_KEY", "")

        if not self.pinecone_api_key:
            raise ValueError("PINECONE_API_KEY not set in environment")

        # Google API is optional (use fallback if not available)
        if not self.google_api_key:
            print("[WARN] GOOGLE_API_KEY not set - semantic search will use placeholder embeddings")
        else:
            genai.configure(api_key=self.google_api_key)

        # Initialize Pinecone
        self.pc = Pinecone(api_key=self.pinecone_api_key)
        self.index = self.pc.Index(self.pinecone_index_name)

        # Initialize Intent-Action Validator (for red stop sign on contradictory queries)
        self.intent_validator = IntentActionValidator()

        # Load local chunks for fallback retrieval
        self.local_chunks = self._load_local_chunks()

    def _load_local_chunks(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load chunked skills from local JSON files for fallback retrieval."""
        chunks = {}
        data_dir = Path("mcp_server/data")

        if data_dir.exists():
            try:
                all_chunks_file = data_dir / "skill_chunks_all.json"
                if all_chunks_file.exists():
                    with open(all_chunks_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        chunks = data.get("chunks_by_skill", {})
                    print(f"[INIT] Loaded {len(chunks)} skill files with local chunks")
            except Exception as e:
                print(f"[WARN] Failed to load local chunks: {e}")

        return chunks

    def _detect_workstream(self, query: str, history: Optional[List[str]] = None) -> tuple[str, float]:
        """Detect workstream from query and conversation history."""
        # Combine query + recent history
        search_context = query.lower()
        if history:
            search_context = " ".join(h.lower() for h in history[-3:]) + " " + search_context

        # Keyword matching for each workstream
        workstream_scores = {}
        for ws, keywords in self.WORKSTREAM_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in search_context)
            if matches > 0:
                workstream_scores[ws] = matches

        if workstream_scores:
            best_ws = max(workstream_scores, key=workstream_scores.get)
            confidence = min(workstream_scores[best_ws] / 2.0, 1.0)  # Normalize to 0-1
            return best_ws, confidence

        return "", 0.0

    def _get_related_workstreams(self, primary_ws: str) -> List[str]:
        """Get related workstreams for broader search when confidence is low."""
        return self.RELATED_WORKSTREAMS.get(primary_ws, [primary_ws])

    def _embed_text(self, text: str) -> List[float]:
        """Generate semantic embedding using Google Gemini API.

        Uses models/gemini-embedding-001 which returns 3072-dimensional vectors.
        Falls back to deterministic hashing only if API is unavailable.
        """
        # Try real semantic embedding first
        if self.google_api_key:
            try:
                result = genai.embed_content(
                    model="models/gemini-embedding-001",
                    content=text,
                    task_type="retrieval_query"
                )
                embedding = result.get('embedding', []) if isinstance(result, dict) else (
                    result.embedding if hasattr(result, 'embedding') else []
                )
                if embedding and len(embedding) > 0:
                    return embedding
            except Exception as e:
                print(f"[EMBED] Google embedding failed: {str(e)[:80]}")

        # Fallback: deterministic hashing (consistent with upsert fallback)
        print(f"[EMBED] Using deterministic fallback (3072 dims)")
        import hashlib

        text_hash = hashlib.md5(text.encode()).hexdigest()

        # Create pseudo-random but deterministic embedding (MUST be 3072 dims)
        embedding = []
        for i in range(3072):
            # Mix multiple hashes to create variation
            chunk_hash = hashlib.md5(f"{text_hash}_{i}".encode()).hexdigest()
            # Convert to float (0.0-1.0), ensure non-zero
            value = float(int(chunk_hash, 16) % 1000) / 1000.0
            value = max(0.001, value)  # Ensure minimum non-zero value
            embedding.append(value)

        # Normalize to unit length for cosine similarity
        norm = sum(v**2 for v in embedding) ** 0.5
        if norm > 0:
            embedding = [v / norm for v in embedding]

        return embedding

    async def hybrid_search(
        self,
        user_query: str,
        explicit_workstream: Optional[str] = None,
        conversation_history: Optional[List[str]] = None,
        top_k: int = 5
    ) -> SkillRetrievalResult:
        """Perform hybrid search: workstream detection + semantic + confidence re-ranking."""

        # For Inventory Management: don't filter by workstream, let semantic search find best Product Sourcing chunks
        # For other workstreams: use workstream filter for high-confidence matches
        skip_workstream_filter = explicit_workstream == "Inventory Management"

        # FIX 1: Use explicit workstream parameter if provided (high confidence)
        if explicit_workstream and not skip_workstream_filter:
            print(f"[SEARCH] Received explicit_workstream: {explicit_workstream}")
            workstream = explicit_workstream
            print(f"[SEARCH] Using workstream: {workstream}")
            ws_confidence = 1.0
        else:
            # DISABLED: Don't detect workstream here - let domain_intent_detector handle it
            # Pinecone will search all workstreams broadly via semantic search
            workstream = ""
            ws_confidence = 0.0

        # FIX 3: Build Pinecone filter with improved threshold logic
        pinecone_filter = None
        if workstream and not skip_workstream_filter:
            if ws_confidence >= 0.7:
                # High confidence: search only this workstream
                pinecone_filter = {"workstreams": {"$in": [workstream]}}
            elif ws_confidence >= 0.5:
                # Medium confidence: search related workstreams
                related_ws = self._get_related_workstreams(workstream)
                pinecone_filter = {"workstreams": {"$in": related_ws}}
            # else: low confidence (< 0.5), search all workstreams (pinecone_filter = None)
        elif skip_workstream_filter:
            print(f"[SEARCH] Inventory Management query - no workstream filter (using semantic search only)")

        # 1. Try Pinecone semantic search
        semantic_results = None
        try:
            query_embedding = self._embed_text(user_query)
            print(f"[SEARCH] Query: '{user_query[:50]}'")
            print(f"[SEARCH] Embedding dim: {len(query_embedding)}")
            print(f"[SEARCH] Filter: {pinecone_filter}")
            print(f"[SEARCH] Namespace: {self.pinecone_namespace}")

            semantic_results = self.index.query(
                vector=query_embedding,
                top_k=top_k * 4,  # Get more for re-ranking
                filter=pinecone_filter,
                include_metadata=True,
                namespace=self.pinecone_namespace
            )
            print(f"[SEARCH] Pinecone returned {len(semantic_results.matches) if semantic_results else 0} results")
        except Exception as e:
            print(f"[WARN] Pinecone search failed: {e}")
            import traceback
            traceback.print_exc()

        # 2. Fallback: local chunk search if Pinecone fails
        if not semantic_results or not semantic_results.matches:
            print(f"[FALLBACK] Using local chunks for search")
            semantic_results = self._local_fallback_search(user_query, workstream, top_k * 4)

        # 3. Re-rank and format results
        skills_dict = {}

        if semantic_results and hasattr(semantic_results, 'matches'):
            for match in semantic_results.matches:
                skill_id = match.id
                score = float(match.score) if hasattr(match, 'score') else 0.5
                metadata = match.metadata or {}

                # Parse JSON-encoded list fields from Pinecone metadata
                def parse_json_field(field):
                    val = metadata.get(field, [])
                    if isinstance(val, str):
                        try:
                            return json.loads(val)
                        except (json.JSONDecodeError, ValueError):
                            return []
                    return val if isinstance(val, list) else []

                # Handle both old flat vectors and new hierarchical vectors
                is_hierarchical = metadata.get("is_parent") is not None

                if is_hierarchical:
                    # New hierarchical format with Impact/Effect keywords
                    api_names = [metadata.get("api_name", "")] if metadata.get("api_name") else []

                    # Support both impact_keywords and keywords fields (space or comma separated)
                    keywords_str = metadata.get("impact_keywords", "") or metadata.get("keywords", "")
                    if keywords_str:
                        # Handle both space-separated (new format) and comma-separated (old format)
                        if "," in keywords_str:
                            keywords = [kw.strip() for kw in keywords_str.split(",")]
                        else:
                            keywords = [kw.strip() for kw in keywords_str.split()]
                    else:
                        keywords = []

                    # Support workstream field for hierarchical vectors
                    workstream_single = metadata.get("workstream", "")
                    workstreams = [workstream_single] if workstream_single else []

                    ue_patterns = []
                    db_tables = []
                else:
                    # Old flat format
                    workstreams = parse_json_field("workstreams")
                    api_names = parse_json_field("api_names")
                    ue_patterns = parse_json_field("ue_patterns")
                    db_tables = parse_json_field("db_tables")
                    keywords = parse_json_field("keywords")

                # Apply workstream boost
                if workstream and workstream in workstreams:
                    score *= 1.5

                # Apply confidence boost
                confidence = metadata.get("confidence", 0.5)
                score *= (0.5 + confidence)  # 0.5-1.5x multiplier

                # Apply chunk type boost for business rules
                chunk_type = metadata.get("chunk_type", "")
                if chunk_type == "business_rules":
                    score *= 1.3

                # Store hierarchical metadata if present
                hierarchical_meta = None
                if is_hierarchical:
                    hierarchical_meta = {
                        "api_name": metadata.get("api_name", ""),
                        "is_parent": metadata.get("is_parent", False),
                        "parent_id": metadata.get("parent_id", ""),
                        "aspect": metadata.get("aspect", ""),
                        "canonical_description": metadata.get("canonical_description", ""),
                        "aspects_available": metadata.get("aspects_available", ""),
                        "aspect_count": metadata.get("aspect_count", 0),
                    }

                skills_dict[skill_id] = {
                    "id": skill_id,
                    "skill_name": metadata.get("skill_name", ""),
                    "chunk_type": chunk_type,
                    "workstreams": workstreams,
                    "relevance_score": score,
                    "confidence": confidence,
                    "content": metadata.get("content", ""),
                    "api_names": api_names,
                    "ue_patterns": ue_patterns,
                    "db_tables": db_tables,
                    "keywords": keywords,
                    "hierarchical_meta": hierarchical_meta,
                }

        # HIERARCHICAL ENHANCEMENT: If child vectors found, also include their parents
        parent_ids_to_fetch = set()
        for skill in skills_dict.values():
            if skill.get("hierarchical_meta") and skill["hierarchical_meta"].get("parent_id"):
                parent_ids_to_fetch.add(skill["hierarchical_meta"]["parent_id"])

        # Fetch parent vectors for any children found
        if parent_ids_to_fetch:
            try:
                parent_results = self.index.fetch(
                    ids=list(parent_ids_to_fetch),
                    namespace=self.pinecone_namespace
                )
                for parent_id, parent_vec in parent_results.get('vectors', {}).items():
                    if parent_id not in skills_dict:  # Don't duplicate if already present
                        parent_metadata = parent_vec.get('metadata', {})

                        # Parse parent metadata with Impact/Effect keywords support
                        keywords_str = parent_metadata.get("impact_keywords", "") or parent_metadata.get("keywords", "")
                        if keywords_str:
                            # Handle both space-separated (new format) and comma-separated (old format)
                            if "," in keywords_str:
                                keywords = [kw.strip() for kw in keywords_str.split(",")]
                            else:
                                keywords = [kw.strip() for kw in keywords_str.split()]
                        else:
                            keywords = []

                        # Support workstream field for parent vectors
                        workstream_single = parent_metadata.get("workstream", "")
                        parent_workstreams = [workstream_single] if workstream_single else []

                        hierarchical_meta = {
                            "api_name": parent_metadata.get("api_name", ""),
                            "is_parent": True,
                            "parent_id": "",
                            "aspect": "",
                            "canonical_description": parent_metadata.get("canonical_description", ""),
                            "aspects_available": parent_metadata.get("aspects_available", ""),
                            "aspect_count": parent_metadata.get("aspect_count", 0),
                        }

                        skills_dict[parent_id] = {
                            "id": parent_id,
                            "skill_name": "",
                            "chunk_type": "",
                            "workstreams": parent_workstreams,
                            "relevance_score": 0.5,  # Lower score than semantic match, but present
                            "confidence": 0.9,
                            "content": parent_metadata.get("canonical_description", ""),
                            "api_names": [parent_metadata.get("api_name", "")],
                            "ue_patterns": [],
                            "db_tables": [],
                            "keywords": keywords,
                            "hierarchical_meta": hierarchical_meta,
                            # Add schema fields if present
                            "has_schema": parent_metadata.get("has_schema", False),
                            "input_fields": parent_metadata.get("input_fields", ""),
                            "output_fields": parent_metadata.get("output_fields", ""),
                            "input_sample": parent_metadata.get("input_sample", ""),
                            "output_sample": parent_metadata.get("output_sample", ""),
                        }
            except Exception as e:
                print(f"[WARN] Failed to fetch parent vectors: {e}")

        # Sort by relevance score
        sorted_skills = sorted(
            skills_dict.values(),
            key=lambda x: x["relevance_score"],
            reverse=True
        )[:top_k]

        # Format output
        top_skills = []
        for skill in sorted_skills:
            # Build metadata based on vector type
            if skill.get("hierarchical_meta"):
                # Hierarchical vector
                out_metadata = {
                    "api_name": skill["hierarchical_meta"]["api_name"],
                    "is_parent": skill["hierarchical_meta"]["is_parent"],
                    "parent_id": skill["hierarchical_meta"]["parent_id"],
                    "aspect": skill["hierarchical_meta"]["aspect"],
                    "canonical_description": skill["hierarchical_meta"]["canonical_description"],
                    "aspects_available": skill["hierarchical_meta"]["aspects_available"],
                    "aspect_count": skill["hierarchical_meta"]["aspect_count"],
                    "keywords": skill["keywords"][:5],
                }

                # Add schema fields if present (from enrichment phase)
                if skill.get("has_schema"):
                    out_metadata["input_fields"] = skill.get("input_fields", "")
                    out_metadata["output_fields"] = skill.get("output_fields", "")
                    out_metadata["input_sample"] = skill.get("input_sample", "")
                    out_metadata["output_sample"] = skill.get("output_sample", "")

                # For hierarchical, skill_name is the API name
                skill_name = skill["hierarchical_meta"]["api_name"]
            else:
                # Old flat vector
                out_metadata = {
                    "api_names": skill["api_names"][:5],
                    "ue_patterns": skill["ue_patterns"][:5],
                    "keywords": skill["keywords"][:5],
                }
                skill_name = skill["skill_name"]

            top_skills.append({
                "filename": skill_name,
                "chunk_type": skill["chunk_type"],
                "workstreams": skill["workstreams"],
                "relevance_score": round(skill["relevance_score"], 4),
                "confidence": round(skill["confidence"], 2),
                "content": skill["content"],
                "why_ranked": f"workstream_match | type: {skill['chunk_type']} | confidence: {skill['confidence']:.2f}",
                "metadata": out_metadata
            })

        # FIX 4: Better context guide message
        if explicit_workstream:
            context_msg = f"Explicit workstream: {workstream}"
        elif ws_confidence >= 0.7:
            context_msg = f"High confidence detection: {workstream}"
        elif ws_confidence >= 0.5:
            context_msg = f"Medium confidence: {workstream} (also checking related workstreams)"
        else:
            context_msg = "Low confidence - searching all workstreams"

        # VALIDATION: Intent-Action capability check (red stop sign for contradictory queries)
        user_intent = self.intent_validator.extract_user_intent(user_query)
        validation_status = ""
        alternatives = None
        final_top_skills = top_skills

        # Only validate if user query has specific action intent
        if user_intent['action']:
            exact_matches, partial_matches, status_msg = self.intent_validator.filter_results(
                top_skills,
                user_intent
            )

            validation_status = status_msg

            if exact_matches:
                # Return exact matches (these are what user asked for)
                final_top_skills = exact_matches
                print(f"[VALIDATE] Exact match found: {len(exact_matches)} APIs support '{user_intent['action']}' on {user_intent['entity']}")
            elif partial_matches:
                # User had specific action but no exact match - show warning and offer alternatives
                alternatives = self.intent_validator.generate_alternatives(
                    partial_matches,
                    user_intent
                )
                final_top_skills = partial_matches[:5]  # Show top 5 partial matches
                print(f"[VALIDATE] [WARNING] No exact match for '{user_intent['action']}' on {user_intent['entity']}")
                print(f"[VALIDATE] Alternatives: {alternatives['suggestion']}")
            else:
                # No semantic matches at all
                print(f"[VALIDATE] No results found for user query")

        return SkillRetrievalResult(
            domain_detected=workstream or "General",
            domain_confidence=round(ws_confidence, 2),
            context_guide={"filename": f"{workstream or 'General'} Skills", "snippet": context_msg},
            top_skills=final_top_skills,
            re_ranking_applied="workstream_detection (threshold 0.7+) + related_ws_fallback + semantic_score + confidence_boost + chunk_type_boost | action-capability-validation",
            validation_status=validation_status,
            alternatives=alternatives
        )

    def _local_fallback_search(
        self,
        query: str,
        workstream: Optional[str],
        top_k: int = 20
    ) -> Optional[List[Dict[str, Any]]]:
        """Fallback search using local chunks when Pinecone fails."""
        from dataclasses import dataclass
        from typing import NamedTuple

        class MockMatch(NamedTuple):
            id: str
            score: float
            metadata: dict

        query_lower = query.lower()
        results = []

        # Get related workstreams for fallback
        allowed_workstreams = self._get_related_workstreams(workstream) if workstream else None

        # Search through local chunks
        for skill_name, chunks in self.local_chunks.items():
            for chunk in chunks:
                # Check workstream filter (include related workstreams for fallback)
                if workstream:
                    chunk_workstreams = chunk.get("workstreams", [])
                    # Match if chunk is in primary workstream OR in related workstreams
                    if not any(ws in allowed_workstreams for ws in chunk_workstreams):
                        continue

                # Calculate relevance score based on keywords and metadata
                content = chunk.get("content", "").lower()
                skill_keywords = chunk.get("keywords", [])

                # Keyword matches in content
                keyword_matches = sum(1 for kw in query_lower.split() if kw in content)
                metadata_matches = sum(1 for kw in query_lower.split() if kw in " ".join(skill_keywords).lower())

                score = (keyword_matches * 0.3 + metadata_matches * 0.7) / max(1, len(query_lower.split()))

                if score > 0:
                    mock_match = MockMatch(
                        id=chunk.get("chunk_id", skill_name),
                        score=score,
                        metadata={
                            "skill_name": skill_name,
                            "chunk_type": chunk.get("chunk_type", ""),
                            "workstreams": chunk.get("workstreams", []),
                            "confidence": chunk.get("confidence", 0.5),
                            "api_names": chunk.get("api_names", []),
                            "ue_patterns": chunk.get("ue_patterns", []),
                            "db_tables": chunk.get("db_tables", []),
                            "keywords": chunk.get("keywords", []),
                        }
                    )
                    results.append(mock_match)

        # Sort and return top_k
        results.sort(key=lambda x: x.score, reverse=True)

        # Return mock results object
        class MockResults:
            def __init__(self, matches):
                self.matches = matches

        return MockResults(results[:top_k])


# Singleton instance
_manager: Optional[PineconeSkillsManager] = None


def get_skills_manager() -> PineconeSkillsManager:
    """Get or create the skills manager instance."""
    global _manager
    if _manager is None:
        _manager = PineconeSkillsManager()
    return _manager
