"""Extract actual IBM-documented XML examples from HTML files."""
import os
import json
import logging
from pathlib import Path
from typing import Dict, Tuple, Optional

logger = logging.getLogger(__name__)


class HTMLXMLExtractor:
    """Extract XML examples from IBM Sterling HTML documentation."""

    def __init__(self, html_base_path: str, xml_base_path: str):
        """Initialize extractor with paths to HTML and XML folders.

        Args:
            html_base_path: Path to XSD/HTML folder
            xml_base_path: Path to XML folder
        """
        self.html_base = Path(html_base_path)
        self.xml_base = Path(xml_base_path)
        self.xml_cache = {}

    def extract_all_xml_examples(self) -> Dict[str, Dict[str, str]]:
        """Extract XML examples for all APIs.

        Returns:
            {
                "YFS_getOrderList": {
                    "input_xml": "...",
                    "output_xml": "..."
                },
                ...
            }
        """
        examples = {}

        if not self.html_base.exists():
            logger.error(f"HTML base path does not exist: {self.html_base}")
            return examples

        # Find all _input.html files
        input_files = sorted(self.html_base.glob("*_input.html"))
        logger.info(f"Found {len(input_files)} input HTML files")

        for input_html_file in input_files:
            # Extract API name from filename
            # e.g., "INV_changeResourcePool_input.html" -> "INV_changeResourcePool"
            api_name = input_html_file.stem.replace("_input", "")

            # Load XML files
            input_xml = self._load_xml_file(f"{api_name}_input")
            output_xml = self._load_xml_file(f"{api_name}_output")

            if input_xml or output_xml:
                examples[api_name] = {
                    "input_xml": input_xml or "",
                    "output_xml": output_xml or "",
                }

                if len(examples) % 500 == 0:
                    logger.info(f"Extracted {len(examples)} API examples...")

        logger.info(f"Total XML examples extracted: {len(examples)}")
        return examples

    def _load_xml_file(self, xml_name: str) -> Optional[str]:
        """Load XML content from XML folder.

        Args:
            xml_name: XML filename without extension (e.g., "YFS_getOrderList_input")

        Returns:
            XML content as string, or None if file not found
        """
        if xml_name in self.xml_cache:
            return self.xml_cache[xml_name]

        xml_file = self.xml_base / f"{xml_name}.xml"

        if not xml_file.exists():
            logger.debug(f"XML file not found: {xml_file}")
            return None

        try:
            with open(xml_file, "r", encoding="utf-8") as f:
                content = f.read()
                self.xml_cache[xml_name] = content
                return content
        except Exception as e:
            logger.error(f"Error reading {xml_file}: {e}")
            return None

    def save_examples_to_json(self, output_path: str) -> None:
        """Extract and save XML examples to JSON file.

        Args:
            output_path: Path to save JSON file
        """
        examples = self.extract_all_xml_examples()

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(examples, f, indent=2)

        logger.info(f"XML examples saved to {output_path}")
        logger.info(f"Total APIs: {len(examples)}")

        # Count coverage
        with_input = sum(1 for e in examples.values() if e.get("input_xml"))
        with_output = sum(1 for e in examples.values() if e.get("output_xml"))
        with_both = sum(
            1
            for e in examples.values()
            if e.get("input_xml") and e.get("output_xml")
        )

        logger.info(f"  With input_xml: {with_input}")
        logger.info(f"  With output_xml: {with_output}")
        logger.info(f"  With both: {with_both}")


def extract_xml_examples(
    html_base_path: str, xml_base_path: str, output_json_path: str
) -> Dict[str, Dict[str, str]]:
    """Convenience function to extract and save XML examples.

    Args:
        html_base_path: Path to XSD/HTML folder
        xml_base_path: Path to XML folder
        output_json_path: Path to save JSON file

    Returns:
        Dictionary of extracted examples
    """
    extractor = HTMLXMLExtractor(html_base_path, xml_base_path)
    examples = extractor.extract_all_xml_examples()
    extractor.save_examples_to_json(output_json_path)
    return examples


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    html_base = "D:\\opt\\IBM\\xapidocs\\api_javadocs\\XSD\\HTML"
    xml_base = "D:\\opt\\IBM\\xapidocs\\api_javadocs\\XML"
    output_json = "D:\\Tastemaker_bot\\mcp_server\\data\\xsd_schemas\\xml_examples.json"

    extract_xml_examples(html_base, xml_base, output_json)
