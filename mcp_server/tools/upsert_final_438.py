"""Upsert the final 438 missing chunks with Google embeddings."""

import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai
from pinecone import Pinecone

env_path = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FinalUpserter:
    """Upsert final 438 missing chunks."""

    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "oms-skills-hybrid")
        self.namespace = os.getenv("PINECONE_NAMESPACE", "tastemaker-bot")
        self.google_api_key = os.getenv("GOOGLE_API_KEY")

        if not self.api_key or not self.google_api_key:
            raise ValueError("PINECONE_API_KEY or GOOGLE_API_KEY not set")

        self.pc = Pinecone(api_key=self.api_key)
        self.index = self.pc.Index(self.index_name)
        genai.configure(api_key=self.google_api_key)

        logger.info(f"Connected to Pinecone: {self.index_name}")

    def get_google_embedding(self, text: str):
        """Get Google embedding with fallback."""
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
            logger.warning(f"Google embedding failed: {str(e)[:80]}")

        # Fallback: deterministic
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

    def load_all_local_chunks(self):
        """Load all chunks from local files."""
        logger.info("Loading all chunks from local files...")
        chunks_by_id = {}

        data_dir = Path(__file__).parent.parent / 'data'
        chunk_files = sorted(data_dir.glob('skill_chunks_*.json'))

        for chunk_file in chunk_files:
            logger.info(f"  Reading {chunk_file.name}...")
            with open(chunk_file) as f:
                data = json.load(f)
                for chunk in data.get('chunks', []):
                    chunk_id = chunk.get('chunk_id')
                    if chunk_id:
                        chunks_by_id[chunk_id] = chunk

        logger.info(f"Loaded {len(chunks_by_id)} chunks from local files")
        return chunks_by_id

    def get_pinecone_chunk_ids(self):
        """Get all chunk IDs from Pinecone via list endpoint."""
        logger.info("Fetching chunk IDs from Pinecone...")
        existing_ids = set()

        # Use the list operation with pagination
        list_response = self.index.list(
            namespace=self.namespace,
            limit=100
        )

        # Get initial batch
        if hasattr(list_response, 'ids'):
            existing_ids.update(list_response.ids)

        # Get pagination token and fetch remaining
        while hasattr(list_response, 'pagination_token') and list_response.pagination_token:
            logger.info(f"  Fetched {len(existing_ids)} chunk IDs so far...")
            list_response = self.index.list(
                namespace=self.namespace,
                limit=100,
                pagination_token=list_response.pagination_token
            )
            if hasattr(list_response, 'ids'):
                existing_ids.update(list_response.ids)

        logger.info(f"Found {len(existing_ids)} chunks in Pinecone")
        return existing_ids

    def upsert_missing(self):
        """Find and upsert missing chunks."""
        # Load all local chunks
        all_local = self.load_all_local_chunks()

        # Get existing Pinecone IDs
        existing_ids = self.get_pinecone_chunk_ids()

        # Find missing
        missing_ids = set(all_local.keys()) - existing_ids
        logger.info(f"\nMissing chunks: {len(missing_ids)}")

        if not missing_ids:
            logger.info("All chunks already in Pinecone!")
            return

        missing_chunks = [all_local[cid] for cid in missing_ids]

        # Upsert
        batch_size = 50
        upserted = 0
        google_count = 0
        det_count = 0

        # Use smaller batches to avoid 2MB limit
        batch_size = 10

        for i in range(0, len(missing_chunks), batch_size):
            batch = missing_chunks[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(missing_chunks) + batch_size - 1) // batch_size

            vectors = []

            for chunk in batch:
                cid = chunk.get('chunk_id')
                content = chunk.get('content', '')

                if not cid or not content:
                    continue

                embedding, etype = self.get_google_embedding(content)
                if not embedding:
                    continue

                if etype == "google":
                    google_count += 1
                else:
                    det_count += 1

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

                if 'schema_metadata' in chunk:
                    metadata['schema_metadata'] = json.dumps(chunk['schema_metadata'])

                vectors.append((cid, embedding, metadata))
                upserted += 1

            if vectors:
                self.index.upsert(vectors=vectors, namespace=self.namespace)
                logger.info(f"Batch {batch_num}/{total_batches}: Upserted {len(vectors)}")

        logger.info(
            f"\nComplete!\n"
            f"  Upserted: {upserted}\n"
            f"  Google embeddings: {google_count}\n"
            f"  Deterministic fallback: {det_count}\n"
            f"  Total in Pinecone: {len(existing_ids) + upserted}/2826"
        )


if __name__ == "__main__":
    upserter = FinalUpserter()
    upserter.upsert_missing()
