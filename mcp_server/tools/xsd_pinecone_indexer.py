"""Index parsed XSD schemas into Pinecone for Claude access."""
import json
import logging
import os
from pathlib import Path
from typing import List, Dict, Any
from pinecone import Pinecone

logger = logging.getLogger(__name__)


class XSDPineconeIndexer:
    """Index XSD parsed schemas into Pinecone."""

    def __init__(self, pinecone_api_key: str, index_name: str = "oms-api-schemas"):
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.index_name = index_name
        self.index = self.pc.Index(index_name)
        self.namespace = "xsd-schemas"
        self.vectors_to_upsert = []
        self.vector_id = 0

    def index_xsd_catalog(self, catalog_file: str, api_schemas_file: str) -> None:
        """Index XSD catalog from parsed JSON files."""

        # Load catalogs
        with open(catalog_file) as f:
            catalog = json.load(f)

        with open(api_schemas_file) as f:
            api_schemas = json.load(f)

        logger.info(f"Loaded catalog with {len(catalog)} schemas")
        logger.info(f"Loaded API schemas with {len(api_schemas)} APIs")

        # Index each schema
        for api_name, schema_types in api_schemas.items():
            self._index_api(api_name, schema_types, catalog)

        # Batch upsert
        if self.vectors_to_upsert:
            logger.info(f"Upserting {len(self.vectors_to_upsert)} vectors...")
            self._batch_upsert()

        logger.info("Indexing complete")

    def _index_api(self, api_name: str, schema_types: Dict[str, Dict], catalog: Dict) -> None:
        """Index a single API's input/output schemas."""

        for schema_type, schema_info in schema_types.items():  # input, output
            filename = schema_info.get("filename")
            if not filename or filename not in catalog:
                continue

            schema_data = catalog[filename]
            root_element = schema_data.get("root_element")

            # Create main schema chunk
            self._create_schema_chunk(
                api_name=api_name,
                schema_type=schema_type,
                root_element=root_element,
                schema_data=schema_data,
            )

            # Create element-specific chunks
            self._create_element_chunks(
                api_name=api_name,
                schema_type=schema_type,
                schema_data=schema_data,
            )

    def _create_schema_chunk(
        self,
        api_name: str,
        schema_type: str,
        root_element: str,
        schema_data: Dict,
    ) -> None:
        """Create a chunk for the entire API schema."""

        elements = schema_data.get("elements", {})
        complex_types = schema_data.get("complex_types", {})

        # Build element summary
        element_names = list(elements.keys())
        complex_type_names = list(complex_types.keys())

        content = f"""
API Schema: {api_name} ({schema_type})
Root Element: {root_element}

Available Elements ({len(element_names)}):
{', '.join(element_names[:20])}{'...' if len(element_names) > 20 else ''}

Complex Types ({len(complex_type_names)}):
{', '.join(complex_type_names[:20])}{'...' if len(complex_type_names) > 20 else ''}

This is the {schema_type} schema for the {api_name} Sterling API.
Use this to understand the structure of input/output XML.
"""

        metadata = {
            "api_name": api_name,
            "schema_type": schema_type,
            "root_element": root_element,
            "chunk_type": "api_schema_overview",
            "element_count": len(element_names),
            "complex_type_count": len(complex_type_names),
        }

        self._add_vector(
            id_suffix=f"{api_name}_{schema_type}_overview",
            content=content,
            metadata=metadata,
        )

    def _create_element_chunks(
        self,
        api_name: str,
        schema_type: str,
        schema_data: Dict,
    ) -> None:
        """Create chunks for individual elements."""

        elements = schema_data.get("elements", {})
        complex_types = schema_data.get("complex_types", {})

        # Index top-level elements
        for elem_name, elem_info in list(elements.items())[:50]:  # Limit to first 50
            attributes = elem_info.get("attributes", {})
            annotation = elem_info.get("annotation", "")

            content = f"""
Element: {elem_name}
API: {api_name}
Schema Type: {schema_type}
Type: {elem_info.get('type', 'unknown')}
Min Occurs: {elem_info.get('min_occurs', '1')}
Max Occurs: {elem_info.get('max_occurs', '1')}

Attributes: {', '.join(attributes.keys()) if attributes else 'None'}

Description: {annotation if annotation else 'No description available'}
"""

            metadata = {
                "api_name": api_name,
                "schema_type": schema_type,
                "chunk_type": "element",
                "element_name": elem_name,
                "element_type": elem_info.get("type", ""),
                "attributes": list(attributes.keys()),
                "has_attributes": len(attributes) > 0,
            }

            self._add_vector(
                id_suffix=f"{api_name}_{schema_type}_{elem_name}",
                content=content,
                metadata=metadata,
            )

        # Index complex types
        for ct_name, ct_info in list(complex_types.items())[:50]:  # Limit to first 50
            attributes = ct_info.get("attributes", {})
            children = ct_info.get("children", {})
            annotation = ct_info.get("annotation", "")

            content = f"""
Complex Type: {ct_name}
API: {api_name}
Schema Type: {schema_type}

Attributes ({len(attributes)}): {', '.join(attributes.keys()) if attributes else 'None'}

Child Elements ({len(children)}): {', '.join(children.keys()) if children else 'None'}

Description: {annotation if annotation else 'No description available'}
"""

            metadata = {
                "api_name": api_name,
                "schema_type": schema_type,
                "chunk_type": "complex_type",
                "type_name": ct_name,
                "attributes": list(attributes.keys()),
                "children": list(children.keys()),
                "attribute_count": len(attributes),
                "child_count": len(children),
            }

            self._add_vector(
                id_suffix=f"{api_name}_{schema_type}_type_{ct_name}",
                content=content,
                metadata=metadata,
            )

    def _add_vector(self, id_suffix: str, content: str, metadata: Dict) -> None:
        """Add a vector to be upserted."""
        from sentence_transformers import SentenceTransformer

        # Simple embedding using hash + content
        # In production, use actual embeddings
        embedding = self._simple_embedding(content)

        vector_id = f"xsd_{self.vector_id}_{id_suffix}"
        self.vector_id += 1

        self.vectors_to_upsert.append((vector_id, embedding, {"content": content, **metadata}))

    def _simple_embedding(self, text: str) -> List[float]:
        """Create a simple embedding from text hash."""
        import hashlib

        text_hash = hashlib.md5(text.encode()).hexdigest()

        # Create 1536-dim vector (standard size)
        embedding = []
        for i in range(1536):
            chunk_hash = hashlib.md5(f"{text_hash}_{i}".encode()).hexdigest()
            value = float(int(chunk_hash, 16) % 1000) / 1000.0
            value = max(0.001, value)
            embedding.append(value)

        # Normalize
        norm = sum(v**2 for v in embedding) ** 0.5
        if norm > 0:
            embedding = [v / norm for v in embedding]

        return embedding

    def _batch_upsert(self, batch_size: int = 100) -> None:
        """Upsert vectors in batches."""
        for i in range(0, len(self.vectors_to_upsert), batch_size):
            batch = self.vectors_to_upsert[i : i + batch_size]
            logger.info(f"Upserting batch {i//batch_size + 1}, vectors {len(batch)}")

            # Upsert to Pinecone
            vectors_to_upsert = [(vid, emb, meta) for vid, emb, meta in batch]
            self.index.upsert(vectors=vectors_to_upsert, namespace=self.namespace)


def main():
    """Main entry point."""
    logging.basicConfig(level=logging.INFO)

    # Get API key
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise ValueError("PINECONE_API_KEY not set")

    catalog_file = "D:/Tastemaker_bot/mcp_server/data/xsd_schemas/xsd_catalog.json"
    api_schemas_file = "D:/Tastemaker_bot/mcp_server/data/xsd_schemas/api_schemas.json"

    # Check files exist
    if not Path(catalog_file).exists():
        print(f"ERROR: Catalog file not found: {catalog_file}")
        return

    logger.info("Starting XSD Pinecone indexing...")

    indexer = XSDPineconeIndexer(api_key)
    indexer.index_xsd_catalog(catalog_file, api_schemas_file)

    logger.info("Indexing complete")


if __name__ == "__main__":
    main()
