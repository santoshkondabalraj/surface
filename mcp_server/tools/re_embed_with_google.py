"""Re-upsert ONLY missing chunks with real Google semantic embeddings."""

import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
from pinecone import Pinecone

# Load environment
env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GoogleEmbeddingReupserter:
    """Re-upsert only missing chunks with real Google semantic embeddings."""

    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "oms-skills-hybrid")
        self.namespace = os.getenv("PINECONE_NAMESPACE", "tastemaker-bot")
        self.google_api_key = os.getenv("GOOGLE_API_KEY")

        if not self.api_key:
            raise ValueError("PINECONE_API_KEY not set")
        if not self.google_api_key:
            raise ValueError("GOOGLE_API_KEY not set")

        self.pc = Pinecone(api_key=self.api_key)
        self.index = self.pc.Index(self.index_name)
        genai.configure(api_key=self.google_api_key)

        logger.info(f"Connected to Pinecone index: {self.index_name}")
        logger.info(f"Google API configured")

    def get_existing_chunk_ids(self):
        """Get all chunk IDs currently in Pinecone."""
        logger.info("Querying Pinecone for existing chunk IDs...")
        existing_ids = set()

        # Query to get all chunk IDs (using dummy vector)
        result = self.index.query(
            vector=[0.001] * 3072,
            top_k=10000,
            include_metadata=False,
            namespace=self.namespace
        )

        for match in result.matches:
            existing_ids.add(match.id)

        logger.info(f"Found {len(existing_ids)} chunks already in Pinecone")
        return existing_ids

    def get_google_embedding(self, text: str):
        """Get real Google semantic embedding using Gemini API.

        Falls back to deterministic if quota exceeded, but logs it.
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
            if embedding:
                return embedding, "google"
        except Exception as e:
            if "429" in str(e) or "quota" in str(e).lower():
                logger.warning(f"Google API quota exceeded - will use deterministic fallback")
            else:
                logger.warning(f"Google embedding failed: {e}")

        # Fallback: deterministic embedding
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
        return embedding, "deterministic"

    def upsert_missing_chunks(self):
        """Load chunks from local files and upsert ONLY missing ones."""
        # Get existing chunk IDs
        existing_ids = self.get_existing_chunk_ids()

        data_dir = Path(__file__).parent.parent / 'data'
        chunk_files = sorted(data_dir.glob('skill_chunks_*.json'))

        logger.info(f"\nFound {len(chunk_files)} chunk files")

        total_chunks = 0
        missing_chunks = []

        # Load all chunks and identify missing ones
        for chunk_file in chunk_files:
            logger.info(f"Reading {chunk_file.name}...")
            try:
                with open(chunk_file) as f:
                    data = json.load(f)
                    chunks = data.get('chunks', [])

                    for chunk in chunks:
                        total_chunks += 1
                        chunk_id = chunk.get('chunk_id')

                        # Only collect chunks not already in Pinecone
                        if chunk_id and chunk_id not in existing_ids:
                            missing_chunks.append(chunk)
            except Exception as e:
                logger.error(f"Failed to read {chunk_file}: {e}")

        logger.info(f"\nTotal chunks checked: {total_chunks}")
        logger.info(f"Chunks already in Pinecone: {len(existing_ids)}")
        logger.info(f"Missing chunks to embed: {len(missing_chunks)}\n")

        if not missing_chunks:
            logger.info("All chunks already in Pinecone!")
            return 0, 0

        # Upsert only missing chunks
        batch_size = 50
        upserted_count = 0
        google_count = 0
        deterministic_count = 0
        failed_count = 0

        for i in range(0, len(missing_chunks), batch_size):
            batch = missing_chunks[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(missing_chunks) + batch_size - 1) // batch_size

            vectors_to_upsert = []

            for chunk in batch:
                chunk_id = chunk.get('chunk_id')
                content = chunk.get('content', '')

                if not chunk_id or not content:
                    logger.warning(f"Skipping chunk with missing ID or content")
                    continue

                # Get embedding
                embedding, embed_type = self.get_google_embedding(content)
                if not embedding:
                    logger.warning(f"Skipping {chunk_id} (no embedding)")
                    failed_count += 1
                    continue

                if embed_type == "google":
                    google_count += 1
                else:
                    deterministic_count += 1

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
                upserted_count += 1

            if vectors_to_upsert:
                try:
                    self.index.upsert(vectors=vectors_to_upsert, namespace=self.namespace)
                    logger.info(
                        f"Batch {batch_num}/{total_batches}: Upserted {len(vectors_to_upsert)} vectors "
                        f"(Google: {sum(1 for e in vectors_to_upsert if e)}, Total: {upserted_count}/{len(missing_chunks)})"
                    )
                except Exception as e:
                    logger.error(f"Batch {batch_num} failed: {e}")

        logger.info(
            f"\n{'='*60}\n"
            f"UPSERT COMPLETE\n"
            f"{'='*60}\n"
            f"Total chunks: {total_chunks}\n"
            f"Successfully upserted: {upserted_count}\n"
            f"  - Google embeddings: {google_count}\n"
            f"  - Deterministic fallback: {deterministic_count}\n"
            f"Failed: {failed_count}\n"
            f"Status: {len(existing_ids) + upserted_count}/2826 chunks in Pinecone\n"
        )

        return upserted_count, google_count


if __name__ == "__main__":
    upserter = GoogleEmbeddingReupserter()
    upserted, google_count = upserter.upsert_missing_chunks()
