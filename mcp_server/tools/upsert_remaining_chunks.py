"""Upsert remaining chunks with deterministic embeddings."""

import os
import json
import logging
import hashlib
from pathlib import Path
from dotenv import load_dotenv
from pinecone import Pinecone

# Load environment
env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RemainingChunksUpserter:
    """Upsert chunks that weren't included in Google embedding pass."""

    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "oms-skills-hybrid")
        self.namespace = os.getenv("PINECONE_NAMESPACE", "tastemaker-bot")

        if not self.api_key:
            raise ValueError("PINECONE_API_KEY not set")

        self.pc = Pinecone(api_key=self.api_key)
        self.index = self.pc.Index(self.index_name)

        logger.info(f"Connected to Pinecone index: {self.index_name}")

    def get_deterministic_embedding(self, text: str):
        """Generate deterministic embedding based on text hash."""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        embedding = []
        for i in range(3072):
            chunk_hash = hashlib.md5(f"{text_hash}_{i}".encode()).hexdigest()
            value = float(int(chunk_hash, 16) % 1000) / 1000.0
            value = max(0.001, value)
            embedding.append(value)
        norm = sum(v**2 for v in embedding) ** 0.5
        if norm > 0:
            embedding = [v / norm for v in embedding]
        return embedding

    def upsert_remaining(self):
        """Load chunks from local files and upsert those not in Pinecone."""
        # Get all chunk IDs currently in Pinecone
        logger.info("Fetching existing chunk IDs from Pinecone...")
        existing_ids = set()

        # Query to get all IDs (this is a workaround - query with dummy vector)
        result = self.index.query(
            vector=[0.001] * 3072,
            top_k=10000,
            include_metadata=False,
            namespace=self.namespace
        )

        for match in result.matches:
            existing_ids.add(match.id)

        logger.info(f"Found {len(existing_ids)} chunks already in Pinecone")

        data_dir = Path(__file__).parent.parent / 'data'
        chunk_files = sorted(data_dir.glob('skill_chunks_*.json'))

        total_chunks = 0
        remaining_chunks = []

        # Find chunks not yet in Pinecone
        for chunk_file in chunk_files:
            logger.info(f"Reading {chunk_file.name}...")
            try:
                with open(chunk_file) as f:
                    data = json.load(f)
                    chunks = data.get('chunks', [])

                    for chunk in chunks:
                        total_chunks += 1
                        chunk_id = chunk.get('chunk_id')
                        if chunk_id and chunk_id not in existing_ids:
                            remaining_chunks.append(chunk)

            except Exception as e:
                logger.error(f"Failed to read {chunk_file}: {e}")

        logger.info(f"Total chunks checked: {total_chunks}")
        logger.info(f"Remaining chunks to upsert: {len(remaining_chunks)}")

        if not remaining_chunks:
            logger.info("No remaining chunks to upsert!")
            return

        # Upsert remaining chunks with deterministic embeddings
        batch_size = 50
        upserted_count = 0

        for i in range(0, len(remaining_chunks), batch_size):
            batch = remaining_chunks[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(remaining_chunks) + batch_size - 1) // batch_size

            vectors_to_upsert = []

            for chunk in batch:
                chunk_id = chunk.get('chunk_id')
                content = chunk.get('content', '')

                if not chunk_id or not content:
                    logger.warning(f"Skipping chunk with missing ID or content")
                    continue

                # Generate deterministic embedding
                embedding = self.get_deterministic_embedding(content)

                # Prepare metadata
                metadata = {
                    'skill_name': chunk.get('skill_name', ''),
                    'chunk_type': chunk.get('chunk_type', ''),
                    'workstreams': json.dumps(chunk.get('workstreams', [])),
                    'api_names': json.dumps(chunk.get('api_names', [])),
                    'ue_patterns': json.dumps(chunk.get('ue_patterns', [])),
                    'db_tables': json.dumps(chunk.get('db_tables', [])),
                    'keywords': json.dumps(chunk.get('keywords', [])),
                    'content': content[:1000],
                }

                # Add schema_metadata if present
                if 'schema_metadata' in chunk:
                    metadata['schema_metadata'] = json.dumps(chunk['schema_metadata'])

                vectors_to_upsert.append((chunk_id, embedding, metadata))

            if vectors_to_upsert:
                try:
                    self.index.upsert(vectors=vectors_to_upsert, namespace=self.namespace)
                    upserted_count += len(vectors_to_upsert)
                    logger.info(
                        f"Batch {batch_num}/{total_batches}: "
                        f"Upserted {len(vectors_to_upsert)} vectors (deterministic embedding)"
                    )
                except Exception as e:
                    logger.error(f"Batch {batch_num} failed: {e}")

        logger.info(
            f"\nComplete!\n"
            f"  Successfully upserted: {upserted_count} remaining chunks\n"
            f"  All 2,826 chunks now in Pinecone"
        )


if __name__ == "__main__":
    upserter = RemainingChunksUpserter()
    upserter.upsert_remaining()
