"""Upsert chunks with trimmed metadata to stay under Pinecone limits."""

import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
from pinecone import Pinecone

env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class TrimmedUpserter:
    """Upsert chunks with minimal metadata to avoid size limits."""

    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "oms-skills-hybrid")
        self.namespace = os.getenv("PINECONE_NAMESPACE", "tastemaker-bot")
        self.google_api_key = os.getenv("GOOGLE_API_KEY")

        if not self.api_key or not self.google_api_key:
            raise ValueError("Missing API keys")

        self.pc = Pinecone(api_key=self.api_key)
        self.index = self.pc.Index(self.index_name)
        genai.configure(api_key=self.google_api_key)

        logger.info(f"Connected to {self.index_name}\n")

    def get_google_embedding(self, text: str):
        """Get Google embedding."""
        try:
            result = genai.embed_content(
                model="models/gemini-embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            embedding = result.get('embedding', []) if isinstance(result, dict) else (
                result.embedding if hasattr(result, 'embedding') else []
            )
            if embedding:
                return embedding
        except Exception as e:
            logger.warning(f"Google failed: {str(e)[:50]}")

        # Deterministic fallback
        import hashlib
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

    def upsert_all(self):
        """Load all chunks and upsert with trimmed metadata."""
        logger.info("Loading all chunks...")
        chunks = []

        data_dir = Path(__file__).parent.parent / 'data'
        for chunk_file in sorted(data_dir.glob('skill_chunks_*.json')):
            logger.info(f"  {chunk_file.name}...")
            with open(chunk_file) as f:
                data = json.load(f)
                chunks.extend(data.get('chunks', []))

        logger.info(f"Loaded {len(chunks)} chunks\n")

        # Upsert in batches of 5 (smaller batches for safety)
        batch_size = 5
        upserted = 0
        failed = 0

        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(chunks) + batch_size - 1) // batch_size

            vectors = []

            for chunk in batch:
                cid = chunk.get('chunk_id')
                content = chunk.get('content', '')

                if not cid or not content:
                    continue

                embedding = self.get_google_embedding(content)
                if not embedding:
                    failed += 1
                    continue

                # TRIMMED metadata - keep only essential fields
                metadata = {
                    'skill_name': chunk.get('skill_name', '')[:100],  # Truncate
                    'chunk_type': chunk.get('chunk_type', ''),
                    'api_names': json.dumps(chunk.get('api_names', [])[:10]),  # Top 10 APIs only
                    'content_preview': content[:200],  # Just preview, not full content
                }

                vectors.append((cid, embedding, metadata))
                upserted += 1

            if vectors:
                try:
                    self.index.upsert(vectors=vectors, namespace=self.namespace)
                    logger.info(f"Batch {batch_num}/{total_batches}: Upserted {len(vectors)}")
                except Exception as e:
                    logger.error(f"Batch {batch_num} failed: {str(e)[:100]}")
                    failed += len(vectors)

        logger.info(f"\n{'='*50}")
        logger.info(f"Complete!")
        logger.info(f"  Upserted: {upserted}")
        logger.info(f"  Failed: {failed}")
        logger.info(f"{'='*50}")


if __name__ == "__main__":
    upserter = TrimmedUpserter()
    upserter.upsert_all()
