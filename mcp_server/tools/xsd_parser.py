"""Parse XSD files into structured schema catalog for Pinecone indexing."""
import os
import json
import logging
from pathlib import Path
from xml.etree import ElementTree as ET
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class XSDElement:
    """Represents a single XSD element."""
    name: str
    element_type: str  # "element", "complexType", "simpleType", "attribute"
    cardinality: str  # "0:1", "1:1", "1:N", "0:N"
    attributes: List[str]  # Attribute names
    children: List[str]  # Child element names
    type_ref: Optional[str]  # Reference to complexType or simpleType
    required: bool
    description: str
    depth: int
    parent_element: Optional[str]
    namespace: str


class XSDParser:
    """Parse XSD files into structured schema catalog."""

    NAMESPACE = {
        'xsd': 'http://www.w3.org/2001/XMLSchema',
        'yfc': 'http://www.sterlingcommerce.com/documentation'
    }

    def __init__(self, xsd_directory: str):
        self.xsd_dir = Path(xsd_directory)
        self.catalog = {}
        self.api_schemas = {}  # api_name -> {input: {...}, output: {...}}

    def parse_all_xsds(self) -> Dict[str, Any]:
        """Parse all XSD files in directory."""
        # Handle both forward and backward slashes
        if not self.xsd_dir.exists():
            logger.error(f"XSD directory not found: {self.xsd_dir}")
            return {}

        xsd_files = list(self.xsd_dir.glob("*.xsd"))
        logger.info(f"XSD dir: {self.xsd_dir}, exists: {self.xsd_dir.exists()}")
        logger.info(f"Found {len(xsd_files)} XSD files to parse")

        for i, xsd_file in enumerate(xsd_files):
            if i % 100 == 0:
                logger.info(f"Progress: {i}/{len(xsd_files)}")

            try:
                self._parse_xsd_file(xsd_file)
            except Exception as e:
                logger.warning(f"Error parsing {xsd_file.name}: {e}")

        logger.info(f"Parsed {len(self.catalog)} schemas")
        return self.catalog

    def _parse_xsd_file(self, xsd_file: Path) -> None:
        """Parse a single XSD file."""
        tree = ET.parse(xsd_file)
        root = tree.getroot()

        filename = xsd_file.stem
        namespace = root.get('targetNamespace', '')

        # Extract root element
        root_element = self._get_root_element(root)
        if not root_element:
            return

        # Parse structure
        schema_info = {
            'filename': filename,
            'namespace': namespace,
            'root_element': root_element,
            'elements': self._parse_elements(root),
            'complex_types': self._parse_complex_types(root),
            'simple_types': self._parse_simple_types(root),
        }

        self.catalog[filename] = schema_info

        # Categorize as input/output if API schema
        self._categorize_api_schema(filename, schema_info)

    def _get_root_element(self, root: ET.Element) -> Optional[str]:
        """Extract root element name from XSD annotation."""
        annotation = root.find('.//xsd:annotation', self.NAMESPACE)
        if annotation is not None:
            appinfo = annotation.find('xsd:appinfo', self.NAMESPACE)
            if appinfo is not None:
                root_elem = appinfo.get('yfc:rootElement')
                if root_elem:
                    return root_elem

        # Fallback: first element in schema
        elements = root.findall('.//xsd:element', self.NAMESPACE)
        if elements:
            return elements[0].get('name')

        return None

    def _parse_elements(self, root: ET.Element) -> Dict[str, Dict[str, Any]]:
        """Parse all element definitions."""
        elements = {}

        for elem in root.findall('.//xsd:element', self.NAMESPACE):
            name = elem.get('name')
            if not name:
                continue

            elem_info = {
                'name': name,
                'type': elem.get('type', ''),
                'min_occurs': elem.get('minOccurs', '1'),
                'max_occurs': elem.get('maxOccurs', '1'),
                'ref': elem.get('ref', ''),
                'annotation': self._get_annotation(elem),
                'attributes': self._parse_element_attributes(elem),
            }

            elements[name] = elem_info

        return elements

    def _parse_complex_types(self, root: ET.Element) -> Dict[str, Dict[str, Any]]:
        """Parse complexType definitions."""
        complex_types = {}

        for ct in root.findall('.//xsd:complexType', self.NAMESPACE):
            name = ct.get('name')
            if not name:
                continue

            ct_info = {
                'name': name,
                'attributes': self._parse_ct_attributes(ct),
                'children': self._parse_ct_children(ct),
                'annotation': self._get_annotation(ct),
            }

            complex_types[name] = ct_info

        return complex_types

    def _parse_simple_types(self, root: ET.Element) -> Dict[str, Dict[str, Any]]:
        """Parse simpleType definitions."""
        simple_types = {}

        for st in root.findall('.//xsd:simpleType', self.NAMESPACE):
            name = st.get('name')
            if not name:
                continue

            # Extract restrictions
            restriction = st.find('xsd:restriction', self.NAMESPACE)
            enumerations = []
            if restriction is not None:
                enumerations = [e.get('value') for e in restriction.findall('xsd:enumeration', self.NAMESPACE)]

            st_info = {
                'name': name,
                'base_type': restriction.get('base') if restriction is not None else '',
                'enumerations': enumerations,
                'annotation': self._get_annotation(st),
            }

            simple_types[name] = st_info

        return simple_types

    def _parse_element_attributes(self, elem: ET.Element) -> Dict[str, str]:
        """Parse attributes of an element."""
        attributes = {}

        # Direct attributes
        for attr in elem.findall('xsd:attribute', self.NAMESPACE):
            attr_name = attr.get('name')
            if attr_name:
                attributes[attr_name] = {
                    'type': attr.get('type', ''),
                    'use': attr.get('use', 'optional'),
                    'annotation': self._get_annotation(attr),
                }

        # Attributes via complexType
        type_ref = elem.get('type')
        if type_ref:
            # Handle local complexType
            ct = elem.find('xsd:complexType', self.NAMESPACE)
            if ct is not None:
                for attr in ct.findall('.//xsd:attribute', self.NAMESPACE):
                    attr_name = attr.get('name')
                    if attr_name:
                        attributes[attr_name] = {
                            'type': attr.get('type', ''),
                            'use': attr.get('use', 'optional'),
                        }

        return attributes

    def _parse_ct_attributes(self, ct: ET.Element) -> Dict[str, Dict[str, str]]:
        """Parse attributes in complexType."""
        attributes = {}

        for attr in ct.findall('.//xsd:attribute', self.NAMESPACE):
            attr_name = attr.get('name')
            if attr_name:
                attributes[attr_name] = {
                    'type': attr.get('type', ''),
                    'use': attr.get('use', 'optional'),
                    'annotation': self._get_annotation(attr),
                }

        return attributes

    def _parse_ct_children(self, ct: ET.Element) -> Dict[str, Dict[str, Any]]:
        """Parse child elements in complexType."""
        children = {}

        # Sequence
        sequence = ct.find('xsd:sequence', self.NAMESPACE)
        if sequence is not None:
            for elem in sequence.findall('xsd:element', self.NAMESPACE):
                name = elem.get('name') or elem.get('ref', '')
                if name:
                    children[name] = {
                        'min_occurs': elem.get('minOccurs', '1'),
                        'max_occurs': elem.get('maxOccurs', '1'),
                        'type': elem.get('type', ''),
                    }

        # Choice
        choice = ct.find('xsd:choice', self.NAMESPACE)
        if choice is not None:
            for elem in choice.findall('xsd:element', self.NAMESPACE):
                name = elem.get('name') or elem.get('ref', '')
                if name:
                    children[name] = {
                        'min_occurs': elem.get('minOccurs', '0'),
                        'max_occurs': elem.get('maxOccurs', '1'),
                        'type': elem.get('type', ''),
                        'choice': True,
                    }

        return children

    def _get_annotation(self, elem: ET.Element) -> str:
        """Extract annotation/documentation from element."""
        annotation = elem.find('xsd:annotation', self.NAMESPACE)
        if annotation is not None:
            doc = annotation.find('xsd:documentation', self.NAMESPACE)
            if doc is not None and doc.text:
                return doc.text.strip()

        return ""

    def _categorize_api_schema(self, filename: str, schema_info: Dict) -> None:
        """Categorize schema as input or output API."""
        # Extract API name and type from filename
        # Pattern: YFS_getOrderList_input.xsd or YFS_getOrderList_output.xsd
        parts = filename.split('_')

        if len(parts) >= 2:
            if filename.endswith('_input'):
                api_name = '_'.join(parts[:-1])
                schema_type = 'input'
            elif filename.endswith('_output'):
                api_name = '_'.join(parts[:-1])
                schema_type = 'output'
            else:
                return

            if api_name not in self.api_schemas:
                self.api_schemas[api_name] = {}

            self.api_schemas[api_name][schema_type] = schema_info

    def export_to_json(self, output_dir: str) -> None:
        """Export catalog to JSON files."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Export full catalog
        catalog_file = output_path / "xsd_catalog.json"
        with open(catalog_file, 'w') as f:
            json.dump(self.catalog, f, indent=2, default=str)
        logger.info(f"Exported catalog to {catalog_file}")

        # Export API schemas
        api_file = output_path / "api_schemas.json"
        with open(api_file, 'w') as f:
            json.dump(self.api_schemas, f, indent=2, default=str)
        logger.info(f"Exported API schemas to {api_file}")
        logger.info(f"Total APIs: {len(self.api_schemas)}")


def main():
    """Main entry point for XSD parsing."""
    logging.basicConfig(level=logging.INFO)

    xsd_dir = "D:/opt/IBM/xapidocs/api_javadocs/XSD"
    output_dir = "D:/Tastemaker_bot/mcp_server/data/xsd_schemas"

    logger.info(f"Parsing XSD files from: {xsd_dir}")
    parser = XSDParser(xsd_dir)

    catalog = parser.parse_all_xsds()

    parser.export_to_json(output_dir)

    logger.info(f"Parse complete. Catalog: {len(catalog)} schemas, API schemas: {len(parser.api_schemas)} APIs")


if __name__ == "__main__":
    main()
