"""Upsert skill chunks into Pinecone vector database."""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path

import google.generativeai as genai
from pinecone import Pinecone

logger = logging.getLogger(__name__)


class PineconeUpsertManager:
    """Manage upserts of skill chunks into Pinecone."""

    def __init__(self, index_name: Optional[str] = None, namespace: Optional[str] = None):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = index_name or os.getenv("PINECONE_INDEX_NAME", "oms-skills-hybrid")
        self.namespace = namespace or os.getenv("PINECONE_NAMESPACE", "production")
        self.google_api_key = os.getenv("GOOGLE_API_KEY")

        if not self.api_key:
            raise ValueError("PINECONE_API_KEY not set")
        if not self.google_api_key:
            raise ValueError("GOOGLE_API_KEY not set")

        # Initialize clients
        self.pc = Pinecone(api_key=self.api_key)
        self.index = self.pc.Index(self.index_name)
        genai.configure(api_key=self.google_api_key)

        logger.info(f"[Pinecone] Connected to index '{self.index_name}' namespace '{self.namespace}'")

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text using Google Gemini API.

        Uses models/gemini-embedding-001 which returns 3072-dimensional vectors.
        Falls back to deterministic hashing only if API is unavailable.
        """
        try:
            result = genai.embed_content(
                model="models/gemini-embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            embedding = result.get('embedding', []) if isinstance(result, dict) else (
                result.embedding if hasattr(result, 'embedding') else []
            )
            if embedding and len(embedding) > 0:
                logger.info(f"[Pinecone] Got Google embedding ({len(embedding)} dims)")
                return embedding
        except Exception as e:
            logger.warning(f"[Pinecone] Google embedding failed: {str(e)[:80]}")

        # Fallback: create deterministic embedding based on text hash for upsert
        # This ensures chunks can still be upserted even if embedding API fails
        logger.warning(f"[Pinecone] Using fallback deterministic embedding (3072 dims)")
        import hashlib
        text_hash = hashlib.md5(text.encode()).hexdigest()
        embedding = []
        for i in range(3072):  # Standard embedding dimension for Pinecone
            chunk_hash = hashlib.md5(f"{text_hash}_{i}".encode()).hexdigest()
            value = float(int(chunk_hash, 16) % 1000) / 1000.0
            value = max(0.001, value)
            embedding.append(value)
        # Normalize
        norm = sum(v**2 for v in embedding) ** 0.5
        if norm > 0:
            embedding = [v / norm for v in embedding]
        return embedding

    def upsert_chunk(self, chunk: Dict[str, Any]) -> bool:
        """
        Upsert a single skill chunk into Pinecone.

        Expected chunk structure:
        {
            "chunk_id": "skill-order-capture-001",
            "skill_name": "order-capture.md",
            "chunk_index": 1,
            "chunk_type": "definition",
            "workstreams": ["Order Capture"],
            "api_names": ["createOrder"],
            "ue_patterns": ["OC-001"],
            "db_tables": ["YFS_ORDER_HEADER"],
            "keywords": ["order", "capture"],
            "content": "..."
        }

        Returns:
            True if successful
        """
        try:
            chunk_id = chunk.get("chunk_id")
            if not chunk_id:
                logger.error("Chunk missing 'chunk_id'")
                return False

            # Get embedding from content
            content = chunk.get("content", "")
            if not content:
                logger.error(f"Chunk {chunk_id} has no content")
                return False

            embedding = self._get_embedding(content)
            if not embedding:
                logger.error(f"Failed to get embedding for {chunk_id}")
                return False

            # Prepare metadata
            metadata = {
                "skill_name": chunk.get("skill_name", ""),
                "chunk_type": chunk.get("chunk_type", ""),
                "workstreams": json.dumps(chunk.get("workstreams", [])),
                "api_names": json.dumps(chunk.get("api_names", [])),
                "ue_patterns": json.dumps(chunk.get("ue_patterns", [])),
                "db_tables": json.dumps(chunk.get("db_tables", [])),
                "keywords": json.dumps(chunk.get("keywords", [])),
                "content": content[:1000],  # Store first 1000 chars for reference
            }

            # Upsert to Pinecone
            self.index.upsert(
                vectors=[(chunk_id, embedding, metadata)],
                namespace=self.namespace
            )

            logger.info(f"[Pinecone] Upserted chunk: {chunk_id}")
            return True

        except Exception as e:
            logger.error(f"[Pinecone] Failed to upsert chunk: {e}")
            return False

    def upsert_chunks_batch(self, chunks: List[Dict[str, Any]], batch_size: int = 100) -> int:
        """
        Upsert multiple chunks in batches.

        Args:
            chunks: List of chunk dicts
            batch_size: Number of chunks per batch

        Returns:
            Count of successfully upserted chunks
        """
        success_count = 0
        total_chunks = len(chunks)

        for i in range(0, total_chunks, batch_size):
            batch = chunks[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_chunks + batch_size - 1) // batch_size

            logger.info(f"[Pinecone] Processing batch {batch_num}/{total_batches}")

            vectors_to_upsert = []
            for chunk in batch:
                chunk_id = chunk.get("chunk_id")
                content = chunk.get("content", "")

                if not chunk_id or not content:
                    logger.warning(f"Skipping chunk with missing ID or content")
                    continue

                embedding = self._get_embedding(content)
                if not embedding:
                    logger.warning(f"Skipping chunk {chunk_id} (no embedding)")
                    continue

                metadata = {
                    "skill_name": chunk.get("skill_name", ""),
                    "chunk_type": chunk.get("chunk_type", ""),
                    "workstreams": json.dumps(chunk.get("workstreams", [])),
                    "api_names": json.dumps(chunk.get("api_names", [])),
                    "ue_patterns": json.dumps(chunk.get("ue_patterns", [])),
                    "db_tables": json.dumps(chunk.get("db_tables", [])),
                    "keywords": json.dumps(chunk.get("keywords", [])),
                    "content": content[:1000],
                }

                vectors_to_upsert.append((chunk_id, embedding, metadata))
                success_count += 1

            if vectors_to_upsert:
                try:
                    self.index.upsert(vectors=vectors_to_upsert, namespace=self.namespace)
                    logger.info(f"[Pinecone] Batch {batch_num} upserted ({len(vectors_to_upsert)} vectors)")
                except Exception as e:
                    logger.error(f"[Pinecone] Batch {batch_num} failed: {e}")

        return success_count

    def upsert_from_json(self, json_file: str) -> int:
        """
        Upsert chunks from a JSON file (e.g., skill_chunks_order_capture.json).

        Args:
            json_file: Path to JSON file

        Returns:
            Count of successfully upserted chunks
        """
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            chunks = data.get("chunks", [])
            if not chunks:
                logger.error(f"No 'chunks' array found in {json_file}")
                return 0

            logger.info(f"[Pinecone] Loading {len(chunks)} chunks from {json_file}")
            return self.upsert_chunks_batch(chunks)

        except Exception as e:
            logger.error(f"[Pinecone] Failed to load JSON {json_file}: {e}")
            return 0

    def delete_chunk(self, chunk_id: str) -> bool:
        """Delete a single chunk from Pinecone."""
        try:
            self.index.delete(ids=[chunk_id], namespace=self.namespace)
            logger.info(f"[Pinecone] Deleted chunk: {chunk_id}")
            return True
        except Exception as e:
            logger.error(f"[Pinecone] Failed to delete chunk {chunk_id}: {e}")
            return False

    def delete_chunks_by_skill(self, skill_name: str) -> int:
        """Delete all chunks belonging to a skill."""
        try:
            # Query for chunks with matching skill_name
            results = self.index.query(
                vector=[0] * 768,  # Dummy vector to just filter metadata
                top_k=10000,
                namespace=self.namespace,
                filter={"skill_name": {"$eq": skill_name}}
            )

            chunk_ids = [match["id"] for match in results.get("matches", [])]
            if chunk_ids:
                self.index.delete(ids=chunk_ids, namespace=self.namespace)
                logger.info(f"[Pinecone] Deleted {len(chunk_ids)} chunks for skill: {skill_name}")
                return len(chunk_ids)
            return 0

        except Exception as e:
            logger.error(f"[Pinecone] Failed to delete chunks for {skill_name}: {e}")
            return 0

    def delete_chunks_by_workstream(self, workstream: str) -> int:
        """Delete all chunks in a workstream."""
        try:
            results = self.index.query(
                vector=[0] * 768,
                top_k=10000,
                namespace=self.namespace,
                filter={"workstreams": {"$eq": workstream}}
            )

            chunk_ids = [match["id"] for match in results.get("matches", [])]
            if chunk_ids:
                self.index.delete(ids=chunk_ids, namespace=self.namespace)
                logger.info(f"[Pinecone] Deleted {len(chunk_ids)} chunks for workstream: {workstream}")
                return len(chunk_ids)
            return 0

        except Exception as e:
            logger.error(f"[Pinecone] Failed to delete chunks for workstream {workstream}: {e}")
            return 0


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)

    manager = PineconeUpsertManager()

    # Example: Upsert from JSON file
    json_file = Path("data/skill_chunks_order_capture.json")
    if json_file.exists():
        count = manager.upsert_from_json(str(json_file))
        print(f"✅ Upserted {count} chunks from {json_file}")
    else:
        print(f"❌ File not found: {json_file}")

    # Example: Upsert a single chunk
    sample_chunk = {
        "chunk_id": "skill-demo-001",
        "skill_name": "demo.md",
        "chunk_index": 0,
        "chunk_type": "definition",
        "workstreams": ["Order Capture"],
        "api_names": ["demoAPI"],
        "ue_patterns": [],
        "db_tables": [],
        "keywords": ["demo"],
        "content": "This is a demonstration chunk for testing upsert functionality."
    }
    if manager.upsert_chunk(sample_chunk):
        print("✅ Upserted sample chunk")

    print("✅ Pinecone upsert example complete")
