"""Ingest skill markdown files, chunk them, and upsert to KG and Pinecone."""

import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)


class SkillChunker:
    """Chunk markdown files semantically for ingestion."""

    TARGET_CHUNK_SIZE = 1000  # tokens (~4000 chars)
    MIN_CHUNK_SIZE = 200  # tokens (~800 chars)

    def __init__(self):
        self.chunk_counter = 0

    def estimate_tokens(self, text: str) -> int:
        """Rough estimate: 1 token ≈ 4 characters."""
        return len(text) // 4

    def chunk_markdown(self, content: str, skill_name: str, workstreams: List[str]) -> List[Dict[str, Any]]:
        """
        Chunk markdown content semantically.

        Strategy:
        1. Split by H2 headers (## Section)
        2. If section > TARGET_CHUNK_SIZE, split by H3 (### Subsection)
        3. Merge small chunks with neighbors
        4. Extract metadata (API names, UE patterns, DB tables)

        Returns:
            List of chunk dicts with metadata
        """
        chunks = []
        section_pattern = re.compile(r'^## (.+)$', re.MULTILINE)
        subsection_pattern = re.compile(r'^### (.+)$', re.MULTILINE)

        # Split by H2 sections
        sections = section_pattern.split(content)
        headers = sections[1::2]  # Odd indices are headers
        bodies = sections[2::2]   # Even indices are content after headers

        for section_header, section_body in zip(headers, bodies):
            # Try to split by H3 if section is too large
            if self.estimate_tokens(section_body) > self.TARGET_CHUNK_SIZE * 1.5:
                subsections = subsection_pattern.split(section_body)
                sub_headers = subsections[1::2]
                sub_bodies = subsections[2::2]

                for sub_header, sub_body in zip(sub_headers, sub_bodies):
                    chunk_text = f"## {section_header}\n### {sub_header}\n{sub_body}"
                    if self.estimate_tokens(chunk_text) >= self.MIN_CHUNK_SIZE:
                        chunk = self._create_chunk(
                            chunk_text,
                            skill_name,
                            workstreams,
                            chunk_type=self._detect_chunk_type(sub_header),
                        )
                        chunks.append(chunk)
            else:
                chunk_text = f"## {section_header}\n{section_body}"
                if self.estimate_tokens(chunk_text) >= self.MIN_CHUNK_SIZE:
                    chunk = self._create_chunk(
                        chunk_text,
                        skill_name,
                        workstreams,
                        chunk_type=self._detect_chunk_type(section_header),
                    )
                    chunks.append(chunk)

        logger.info(f"[Ingest] Chunked {skill_name} into {len(chunks)} chunks")
        return chunks

    def _create_chunk(self, content: str, skill_name: str, workstreams: List[str],
                      chunk_type: str = "general") -> Dict[str, Any]:
        """Create a chunk dict with metadata."""
        self.chunk_counter += 1
        chunk_id = f"skill-{Path(skill_name).stem}-{self.chunk_counter:03d}"

        # Extract metadata
        api_names = self._extract_apis(content)
        ue_patterns = self._extract_ues(content)
        db_tables = self._extract_tables(content)
        keywords = self._extract_keywords(content)

        return {
            "chunk_id": chunk_id,
            "skill_name": skill_name,
            "chunk_index": self.chunk_counter,
            "chunk_type": chunk_type,
            "chunk_size_kb": len(content.encode('utf-8')) / 1024,
            "workstreams": workstreams,
            "api_names": api_names,
            "ue_patterns": ue_patterns,
            "db_tables": db_tables,
            "keywords": keywords,
            "content": content,
        }

    def _detect_chunk_type(self, header: str) -> str:
        """Detect chunk type from header name."""
        header_lower = header.lower()
        if "api" in header_lower:
            return "api"
        elif "table" in header_lower or "schema" in header_lower:
            return "schema"
        elif "error" in header_lower or "exception" in header_lower:
            return "error_handling"
        elif "parameter" in header_lower or "config" in header_lower:
            return "parameters"
        elif "flow" in header_lower or "process" in header_lower:
            return "process"
        return "general"

    def _extract_apis(self, content: str) -> List[str]:
        """Extract API names from content."""
        # Look for patterns like: - createOrder, - releaseOrder, etc.
        api_pattern = re.compile(r'(?:^|\n)\s*[-•]\s*([a-zA-Z]+(?:[A-Z][a-z]+)*)\s*(?:\(|$|\n)', re.MULTILINE)
        matches = api_pattern.findall(content)
        # Filter: likely APIs start with lowercase, have camelCase
        apis = [m for m in matches if m[0].islower() and len(m) > 3]
        return list(set(apis))[:10]  # Top 10 unique

    def _extract_ues(self, content: str) -> List[str]:
        """Extract UE patterns (e.g., OC-001, FM-002)."""
        ue_pattern = re.compile(r'\b([A-Z]{2})-(\d{3,4})\b')
        matches = ue_pattern.findall(content)
        ues = [f"{m[0]}-{m[1]}" for m in matches]
        return list(set(ues))[:10]

    def _extract_tables(self, content: str) -> List[str]:
        """Extract database table names (e.g., YFS_ORDER_HEADER)."""
        table_pattern = re.compile(r'\b(YFS_[A-Z_]+|[A-Z]{2,}_[A-Z_]+)\b')
        matches = table_pattern.findall(content)
        tables = [m for m in matches if not m.startswith("YFS_") or len(m) > 10]
        return list(set(tables))[:10]

    def _extract_keywords(self, content: str) -> List[str]:
        """Extract key domain keywords."""
        keywords = []
        domain_terms = [
            "order", "shipment", "invoice", "payment", "inventory",
            "fulfillment", "release", "capture", "return", "exchange",
            "allocation", "authorization", "validation", "exception"
        ]
        for term in domain_terms:
            if re.search(rf'\b{term}\b', content, re.IGNORECASE):
                keywords.append(term)
        return keywords[:8]


class SkillIngestionPipeline:
    """End-to-end skill ingestion pipeline."""

    def __init__(self, pinecone_manager=None, kg_manager=None):
        """
        Initialize pipeline.

        Args:
            pinecone_manager: PineconeUpsertManager instance (optional)
            kg_manager: KGUpsertManager instance (optional)
        """
        self.chunker = SkillChunker()
        self.pinecone_manager = pinecone_manager
        self.kg_manager = kg_manager
        self.all_chunks = []

    def ingest_workstream(self, workstream_dir: str, workstream_name: str) -> int:
        """
        Ingest all markdown files from a workstream directory.

        Args:
            workstream_dir: Path to workstream folder (e.g., "[WORKSTREAM] 1-Order Capture")
            workstream_name: Short name (e.g., "Order Capture")

        Returns:
            Total chunks ingested
        """
        path = Path(workstream_dir)
        if not path.exists():
            logger.error(f"[Ingest] Directory not found: {workstream_dir}")
            return 0

        md_files = list(path.glob("*.md"))
        logger.info(f"[Ingest] Found {len(md_files)} markdown files in {workstream_name}")

        total_chunks = 0
        for md_file in md_files:
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                chunks = self.chunker.chunk_markdown(content, md_file.name, [workstream_name])
                self.all_chunks.extend(chunks)
                total_chunks += len(chunks)

                # Upsert to Pinecone if manager provided
                if self.pinecone_manager:
                    self.pinecone_manager.upsert_chunks_batch(chunks)

            except Exception as e:
                logger.error(f"[Ingest] Failed to process {md_file.name}: {e}")

        return total_chunks

    def save_chunks_to_json(self, output_file: str) -> bool:
        """Save all chunks to JSON for fallback retrieval."""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({"chunks": self.all_chunks}, f, indent=2, ensure_ascii=False)
            logger.info(f"[Ingest] Saved {len(self.all_chunks)} chunks to {output_file}")
            return True
        except Exception as e:
            logger.error(f"[Ingest] Failed to save JSON: {e}")
            return False

    def get_summary(self) -> Dict[str, Any]:
        """Get ingestion summary."""
        return {
            "total_chunks": len(self.all_chunks),
            "total_size_kb": sum(c.get("chunk_size_kb", 0) for c in self.all_chunks),
            "workstreams": list(set(ws for c in self.all_chunks for ws in c.get("workstreams", []))),
            "chunk_types": list(set(c.get("chunk_type", "") for c in self.all_chunks)),
        }


def preserve_existing_chunks(json_file: str, workstream: str,
                            pinecone_manager=None) -> int:
    """
    Preserve and upsert existing chunks from the original ingestion.

    Use this to maintain chunk boundaries with the existing Pinecone index.

    Args:
        json_file: Path to existing chunks JSON (e.g., skill_chunks_ingestion_ready.json)
        workstream: Workstream name to filter by
        pinecone_manager: Optional PineconeUpsertManager to upsert

    Returns:
        Count of chunks preserved
    """
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        chunks = data.get('chunks', [])

        # Filter by workstream
        filtered = [c for c in chunks if workstream in c.get('workstreams', [])]

        logger.info(f"[Preserve] Found {len(filtered)} chunks for {workstream}")

        # Upsert if manager provided
        if pinecone_manager:
            success_count = pinecone_manager.upsert_chunks_batch(filtered)
            logger.info(f"[Preserve] Upserted {success_count} chunks to Pinecone")
            return success_count

        return len(filtered)

    except Exception as e:
        logger.error(f"[Preserve] Failed: {e}")
        return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # OPTION 1: Preserve existing chunks (maintains Pinecone index consistency)
    print("=" * 60)
    print("OPTION 1: Preserve Existing Chunks (RECOMMENDED)")
    print("=" * 60)

    existing_json = "research_artifacts/data_analysis/skill_chunks_ingestion_ready.json"
    if Path(existing_json).exists():
        from pinecone_upsert import PineconeUpsertManager

        pm = PineconeUpsertManager(namespace="production")
        count = preserve_existing_chunks(existing_json, "Order Capture", pm)
        print(f"✅ Preserved {count} chunks from existing index\n")
    else:
        print(f"⚠️  File not found: {existing_json}\n")

    # OPTION 2: Re-ingest (creates new chunks with header-based boundaries)
    print("=" * 60)
    print("OPTION 2: Re-Ingest (New Chunking Strategy)")
    print("=" * 60)
    print("⚠️  WARNING: This will create DIFFERENT chunk boundaries")
    print("    than the original semantic chunking strategy!")
    print()

    pipeline = SkillIngestionPipeline()

    workstream_path = r"D:\opt\IBM\xapidocs\ERD\.claude\skills\[WORKSTREAM] 1-Order Capture"
    if Path(workstream_path).exists():
        chunks_ingested = pipeline.ingest_workstream(workstream_path, "Order Capture")

        if chunks_ingested > 0:
            # Save to JSON for inspection
            output_file = "mcp_server/data/skill_chunks_order_capture_new.json"
            pipeline.save_chunks_to_json(output_file)

            # Print summary
            summary = pipeline.get_summary()
            print(f"⚠️  Re-ingestion complete (new boundaries):")
            print(f"   Total chunks: {summary['total_chunks']}")
            print(f"   Total size: {summary['total_size_kb']:.1f} KB")
            print(f"   Chunk types: {summary['chunk_types']}")
            print(f"\n⚠️  Review {output_file} before upserting to Pinecone!")
        else:
            print("❌ No chunks ingested")
    else:
        print(f"❌ Workstream directory not found: {workstream_path}")
