"""In-memory cache for XSD schemas loaded at MCP startup."""
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


class SchemaCache:
    """Load and cache all XSD schemas in memory for O(1) lookup."""

    def __init__(self, schema_file: str = None, xml_examples_file: str = None):
        """Initialize schema cache."""
        self.schemas: Dict[str, Dict] = {}
        self.xml_examples: Dict[str, Dict[str, str]] = {}
        self.loaded = False

        if schema_file is None:
            schema_file = "D:/Tastemaker_bot/mcp_server/data/xsd_schemas/api_schemas.json"

        if xml_examples_file is None:
            xml_examples_file = "D:/Tastemaker_bot/mcp_server/data/xsd_schemas/xml_examples.json"

        self._load_schemas(schema_file)
        self._load_xml_examples(xml_examples_file)

    def _load_schemas(self, schema_file: str) -> None:
        """Load schemas from JSON file."""
        schema_path = Path(schema_file)

        if not schema_path.exists():
            logger.warning(f"Schema file not found: {schema_file}")
            return

        try:
            with open(schema_path, 'r') as f:
                self.schemas = json.load(f)
            self.loaded = True
            logger.info(f"Loaded {len(self.schemas)} API schemas from {schema_file}")
        except Exception as e:
            logger.error(f"Failed to load schemas: {e}")

    def _load_xml_examples(self, xml_examples_file: str) -> None:
        """Load actual IBM-documented XML examples."""
        examples_path = Path(xml_examples_file)

        if not examples_path.exists():
            logger.warning(f"XML examples file not found: {xml_examples_file}")
            return

        try:
            with open(examples_path, 'r', encoding='utf-8') as f:
                self.xml_examples = json.load(f)
            logger.info(f"Loaded {len(self.xml_examples)} XML example sets from {xml_examples_file}")
        except Exception as e:
            logger.error(f"Failed to load XML examples: {e}")

    def get_schema(self, api_name: str, schema_type: str = "output") -> Optional[Dict]:
        """Get schema for API (input or output)."""
        if api_name not in self.schemas:
            return None

        return self.schemas[api_name].get(schema_type)

    def list_apis(self) -> List[str]:
        """Get list of all available APIs."""
        return sorted(self.schemas.keys())

    def get_elements(self, api_name: str, schema_type: str = "output") -> List[str]:
        """Get list of element names for API schema."""
        schema = self.get_schema(api_name, schema_type)
        if not schema:
            return []

        elements = schema.get("elements", {})
        return sorted(elements.keys())

    def get_complex_types(self, api_name: str, schema_type: str = "output") -> List[str]:
        """Get list of complex type names for API schema."""
        schema = self.get_schema(api_name, schema_type)
        if not schema:
            return []

        complex_types = schema.get("complex_types", {})
        return sorted(complex_types.keys())

    def get_element_info(self, api_name: str, element_name: str, schema_type: str = "output") -> Optional[Dict]:
        """Get detailed info for a specific element."""
        schema = self.get_schema(api_name, schema_type)
        if not schema:
            return None

        elements = schema.get("elements", {})
        return elements.get(element_name)

    def get_element_attributes(self, api_name: str, element_name: str, schema_type: str = "output") -> List[str]:
        """Get attribute names for an element."""
        element_info = self.get_element_info(api_name, element_name, schema_type)
        if not element_info:
            return []

        attributes = element_info.get("attributes", {})
        return sorted(attributes.keys())

    def get_complex_type_info(self, api_name: str, type_name: str, schema_type: str = "output") -> Optional[Dict]:
        """Get detailed info for a complex type."""
        schema = self.get_schema(api_name, schema_type)
        if not schema:
            return None

        complex_types = schema.get("complex_types", {})
        return complex_types.get(type_name)

    def get_complex_type_children(self, api_name: str, type_name: str, schema_type: str = "output") -> List[str]:
        """Get child element names for a complex type."""
        type_info = self.get_complex_type_info(api_name, type_name, schema_type)
        if not type_info:
            return []

        children = type_info.get("children", {})
        return sorted(children.keys())

    def validate_fields(
        self, api_name: str, field_names: List[str], schema_type: str = "output"
    ) -> Dict[str, Dict[str, Any]]:
        """
        Validate that requested fields exist in schema.

        Returns: {field_name: {valid: bool, reason: str, location: str}}
        """
        schema = self.get_schema(api_name, schema_type)
        if not schema:
            return {f: {"valid": False, "reason": f"Schema not found for {api_name}"} for f in field_names}

        validation = {}
        elements = schema.get("elements", {})
        complex_types = schema.get("complex_types", {})

        for field in field_names:
            # Handle nested notation: "OrderLines.OrderLine.Quantity"
            parts = field.split(".")

            valid = False
            location = ""

            if len(parts) == 1:
                # Top-level element
                if field in elements:
                    valid = True
                    location = f"Root[@{field}]"
            else:
                # Nested field - simplified validation
                # In real implementation, would traverse complex type hierarchy
                if parts[0] in complex_types or parts[0] in elements:
                    valid = True
                    location = ".".join(parts)

            validation[field] = {
                "valid": valid,
                "reason": "Field found in schema" if valid else f"Field '{field}' not found in schema",
                "location": location,
            }

        return validation

    def get_xml_example(self, api_name: str, example_type: str = "input") -> Optional[str]:
        """Get actual IBM-documented XML example for API.

        Args:
            api_name: API name (e.g., "getOrderList", "INV_changeResourcePool")
            example_type: "input" or "output"

        Returns:
            XML example as string, or None if not found
        """
        if api_name not in self.xml_examples:
            return None

        examples = self.xml_examples[api_name]
        if example_type == "input":
            return examples.get("input_xml")
        else:
            return examples.get("output_xml")

    def has_xml_examples(self, api_name: str) -> Dict[str, bool]:
        """Check which XML examples are available for API.

        Returns:
            {"input": bool, "output": bool}
        """
        if api_name not in self.xml_examples:
            return {"input": False, "output": False}

        examples = self.xml_examples[api_name]
        return {
            "input": bool(examples.get("input_xml")),
            "output": bool(examples.get("output_xml")),
        }

    def build_template_structure(
        self, api_name: str, desired_fields: List[str] = None, schema_type: str = "output"
    ) -> Optional[Dict[str, Any]]:
        """
        Build template structure from schema and desired fields.

        Returns: {root_element: {...nested structure...}}
        """
        schema = self.get_schema(api_name, schema_type)
        if not schema:
            return None

        root_element = schema.get("root_element")
        if not root_element:
            return None

        # If no specific fields requested, include top-level elements
        if not desired_fields:
            desired_fields = self.get_elements(api_name, schema_type)[:20]  # Top 20

        return {
            "root_element": root_element,
            "requested_fields": desired_fields,
            "schema_type": schema_type,
            "api_name": api_name,
        }


# Global singleton instance
_schema_cache: Optional[SchemaCache] = None


def get_schema_cache() -> SchemaCache:
    """Get or create the global schema cache."""
    global _schema_cache
    if _schema_cache is None:
        _schema_cache = SchemaCache()
    return _schema_cache
