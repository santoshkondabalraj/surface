"""Re-upsert inventory-related chunks with Product Sourcing workstream."""

import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
import hashlib
from pinecone import Pinecone

# Load environment
env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inventory-related keywords to identify chunks
INVENTORY_KEYWORDS = [
    'inventory', 'atp', 'available to promise', 'allocation', 'stock',
    'onhand', 'on-hand', 'reservation', 'reserve', 'availability',
    'available', 'supply', 'fulfillment location', 'shipnode'
]

class InventoryWorkstreamReassigner:
    """Reassign inventory chunks to Product Sourcing workstream."""

    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "oms-skills-hybrid")
        self.namespace = os.getenv("PINECONE_NAMESPACE", "tastemaker-bot")

        if not self.api_key:
            raise ValueError("PINECONE_API_KEY not set")

        self.pc = Pinecone(api_key=self.api_key)
        self.index = self.pc.Index(self.index_name)

        logger.info(f"Connected to Pinecone index: {self.index_name}")

    def is_inventory_chunk(self, chunk: dict) -> bool:
        """Check if chunk is inventory-related."""
        content = chunk.get('content', '').lower()
        skill_name = chunk.get('skill_name', '').lower()
        api_names = chunk.get('api_names', [])

        # Check content and skill name for inventory keywords
        for keyword in INVENTORY_KEYWORDS:
            if keyword in content or keyword in skill_name:
                return True

        # Check API names for inventory APIs
        for api in api_names:
            api_lower = api.lower()
            for keyword in INVENTORY_KEYWORDS:
                if keyword in api_lower:
                    return True

        return False

    def _get_embedding(self, text: str):
        """Generate deterministic embedding."""
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

    def reassign_from_local_files(self):
        """Load chunks from local files and reassign those that are inventory-related."""
        data_dir = Path(__file__).parent.parent / 'data'
        chunk_files = list(data_dir.glob('skill_chunks_*.json'))

        logger.info(f"Found {len(chunk_files)} chunk files")

        total_chunks = 0
        inventory_chunks = []

        # Load all chunks and identify inventory-related ones
        for chunk_file in chunk_files:
            logger.info(f"Reading {chunk_file.name}...")
            try:
                with open(chunk_file) as f:
                    data = json.load(f)
                    chunks = data.get('chunks', [])

                    for chunk in chunks:
                        total_chunks += 1
                        if self.is_inventory_chunk(chunk):
                            inventory_chunks.append(chunk)
            except Exception as e:
                logger.error(f"Failed to read {chunk_file}: {e}")

        logger.info(f"Total chunks: {total_chunks}")
        logger.info(f"Inventory-related chunks identified: {len(inventory_chunks)}")

        # Reassign workstream and re-upsert
        if inventory_chunks:
            self.reassign_workstream(inventory_chunks)

    def reassign_workstream(self, chunks: list):
        """Reassign chunks to Product Sourcing and re-upsert to Pinecone."""
        logger.info(f"\nRe-upserting {len(chunks)} inventory chunks with Product Sourcing workstream...")

        batch_size = 100
        upserted_count = 0

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(chunks) + batch_size - 1) // batch_size

            vectors_to_upsert = []

            for chunk in batch:
                chunk_id = chunk.get('chunk_id')
                content = chunk.get('content', '')

                if not chunk_id or not content:
                    continue

                # Get embedding
                embedding = self._get_embedding(content)
                if not embedding:
                    logger.warning(f"Skipping {chunk_id} (no embedding)")
                    continue

                # Prepare metadata with updated workstreams
                metadata = {
                    'skill_name': chunk.get('skill_name', ''),
                    'chunk_type': chunk.get('chunk_type', ''),
                    'workstreams': json.dumps(['Product Sourcing']),  # Update to Product Sourcing
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
                upserted_count += 1

            if vectors_to_upsert:
                try:
                    self.index.upsert(vectors=vectors_to_upsert, namespace=self.namespace)
                    logger.info(f"Batch {batch_num}/{total_batches}: Upserted {len(vectors_to_upsert)} vectors")
                except Exception as e:
                    logger.error(f"Batch {batch_num} failed: {e}")

        logger.info(f"\n✅ Successfully re-upserted {upserted_count} inventory chunks with Product Sourcing workstream")
        return upserted_count


if __name__ == "__main__":
    reassigner = InventoryWorkstreamReassigner()
    reassigner.reassign_from_local_files()
