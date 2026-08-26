"""
Extract schema enrichment metadata from api_schemas.json.

This script processes the XSD catalog and generates enrichment metadata
that can be embedded into skill chunks to enable schema-aware query generation.

Usage:
    python extract_schema_enrichment.py [input_file] [output_file]
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class Parameter:
    """Represents an API parameter."""
    name: str
    type: str
    use: str  # "required" or "optional"
    annotation: str


@dataclass
class OutputField:
    """Represents an API output field."""
    name: str
    type: str
    annotation: str


@dataclass
class SchemaEnrichment:
    """Enrichment metadata for a single API."""
    api_name: str
    input_root_element: str
    output_root_element: str
    required_parameters: List[Parameter]
    optional_parameters: List[Parameter]
    output_fields: List[OutputField]
    required_field_names: List[str]
    optional_field_names: List[str]


def extract_parameters(complex_types: Dict[str, Dict[str, Any]], root_element: str) -> tuple[List[Parameter], List[Parameter]]:
    """
    Extract required and optional parameters from complex types.

    Args:
        complex_types: Dict of complex type definitions
        root_element: Name of root element to find

    Returns:
        Tuple of (required_params, optional_params)
    """
    required = []
    optional = []

    # Find the main complex type (usually XSDType)
    for ct_name, ct_def in complex_types.items():
        attributes = ct_def.get('attributes', {})

        for attr_name, attr_info in attributes.items():
            param = Parameter(
                name=attr_name,
                type=attr_info.get('type', 'string'),
                use=attr_info.get('use', 'optional'),
                annotation=attr_info.get('annotation', '')
            )

            if attr_info.get('use') == 'required':
                required.append(param)
            else:
                optional.append(param)

    return required, optional


def extract_output_fields(complex_types: Dict[str, Dict[str, Any]]) -> List[OutputField]:
    """
    Extract output field definitions from complex types.

    Args:
        complex_types: Dict of complex type definitions

    Returns:
        List of OutputField objects
    """
    output_fields = []

    # Get first complex type (usually the main output)
    for ct_name, ct_def in list(complex_types.items())[:1]:
        attributes = ct_def.get('attributes', {})

        for attr_name, attr_info in attributes.items():
            field = OutputField(
                name=attr_name,
                type=attr_info.get('type', 'complex'),
                annotation=attr_info.get('annotation', '')
            )
            output_fields.append(field)

    return output_fields


def extract_schema_enrichment(api_name: str, schema_data: Dict[str, Any]) -> Optional[SchemaEnrichment]:
    """
    Extract enrichment metadata from a single API schema.

    Args:
        api_name: Name of the API (e.g., "YFS_getATP")
        schema_data: The complete schema data with input/output

    Returns:
        SchemaEnrichment object or None if extraction fails
    """
    try:
        input_data = schema_data.get('input', {})
        output_data = schema_data.get('output', {})

        # Extract input parameters
        input_complex_types = input_data.get('complex_types', {})
        required_params, optional_params = extract_parameters(input_complex_types, input_data.get('root_element', ''))

        # Extract output fields
        output_complex_types = output_data.get('complex_types', {})
        output_fields = extract_output_fields(output_complex_types)

        enrichment = SchemaEnrichment(
            api_name=api_name,
            input_root_element=input_data.get('root_element', ''),
            output_root_element=output_data.get('root_element', ''),
            required_parameters=required_params,
            optional_parameters=optional_params,
            output_fields=output_fields,
            required_field_names=[p.name for p in required_params],
            optional_field_names=[p.name for p in optional_params]
        )

        return enrichment
    except Exception as e:
        logger.warning(f"Failed to extract enrichment for {api_name}: {e}")
        return None


def extract_all_schemas(api_schemas_file: str) -> Dict[str, Dict[str, Any]]:
    """
    Extract enrichment metadata for all APIs in the catalog.

    Args:
        api_schemas_file: Path to api_schemas.json

    Returns:
        Dict mapping API name to enrichment metadata
    """
    logger.info(f"Loading API schemas from {api_schemas_file}")

    with open(api_schemas_file, 'r') as f:
        api_schemas = json.load(f)

    logger.info(f"Total APIs to process: {len(api_schemas)}")

    enrichments = {}
    success_count = 0
    failed_count = 0

    for i, (api_name, schema_data) in enumerate(api_schemas.items()):
        if (i + 1) % 100 == 0:
            logger.info(f"Progress: {i + 1}/{len(api_schemas)} ({success_count} success, {failed_count} failed)")

        enrichment = extract_schema_enrichment(api_name, schema_data)

        if enrichment:
            # Convert to dict for JSON serialization
            enrichments[api_name] = {
                'api_name': enrichment.api_name,
                'input_root_element': enrichment.input_root_element,
                'output_root_element': enrichment.output_root_element,
                'required_parameters': [
                    {'name': p.name, 'type': p.type, 'annotation': p.annotation}
                    for p in enrichment.required_parameters
                ],
                'optional_parameters': [
                    {'name': p.name, 'type': p.type, 'annotation': p.annotation}
                    for p in enrichment.optional_parameters
                ],
                'output_fields': [
                    {'name': f.name, 'type': f.type, 'annotation': f.annotation}
                    for f in enrichment.output_fields
                ],
                'required_field_names': enrichment.required_field_names,
                'optional_field_names': enrichment.optional_field_names,
                'parameter_count': len(enrichment.required_parameters) + len(enrichment.optional_parameters),
                'output_field_count': len(enrichment.output_fields)
            }
            success_count += 1
        else:
            failed_count += 1

    logger.info(f"Extraction complete: {success_count} success, {failed_count} failed")
    logger.info(f"Total enrichments: {len(enrichments)}")

    return enrichments


def save_enrichments(enrichments: Dict[str, Dict[str, Any]], output_file: str) -> None:
    """
    Save enrichment metadata to JSON file.

    Args:
        enrichments: Dict of enrichment metadata
        output_file: Path to output file
    """
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info(f"Saving {len(enrichments)} enrichments to {output_file}")

    with open(output_file, 'w') as f:
        json.dump(enrichments, f, indent=2)

    # Calculate file size
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(f"Saved successfully ({file_size_mb:.2f} MB)")


def generate_statistics(enrichments: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate statistics about extracted enrichments.

    Args:
        enrichments: Dict of enrichment metadata

    Returns:
        Statistics dict
    """
    total_apis = len(enrichments)
    total_required_params = sum(len(e.get('required_field_names', [])) for e in enrichments.values())
    total_optional_params = sum(len(e.get('optional_field_names', [])) for e in enrichments.values())
    total_output_fields = sum(e.get('output_field_count', 0) for e in enrichments.values())

    avg_required = total_required_params / total_apis if total_apis > 0 else 0
    avg_optional = total_optional_params / total_apis if total_apis > 0 else 0
    avg_outputs = total_output_fields / total_apis if total_apis > 0 else 0

    # APIs with no required parameters
    no_required = sum(1 for e in enrichments.values() if len(e.get('required_field_names', [])) == 0)

    # APIs with many parameters (>10)
    many_params = sum(1 for e in enrichments.values() if e.get('parameter_count', 0) > 10)

    return {
        'total_apis': total_apis,
        'total_required_parameters': total_required_params,
        'total_optional_parameters': total_optional_params,
        'total_output_fields': total_output_fields,
        'average_required_per_api': round(avg_required, 2),
        'average_optional_per_api': round(avg_optional, 2),
        'average_output_fields_per_api': round(avg_outputs, 2),
        'apis_with_no_required_params': no_required,
        'apis_with_10_plus_params': many_params,
    }


def main(input_file: str = 'D:/Tastemaker_bot/mcp_server/data/xsd_schemas/api_schemas.json',
         output_file: str = 'D:/Tastemaker_bot/mcp_server/tools/schema_enrichment_metadata.json'):
    """
    Main entry point for schema enrichment extraction.

    Args:
        input_file: Path to api_schemas.json
        output_file: Path to output enrichment file
    """
    logger.info(f"\n{'='*60}")
    logger.info("PHASE 1: Extract Schema Enrichment Metadata")
    logger.info(f"{'='*60}\n")

    logger.info(f"Input:  {input_file}")
    logger.info(f"Output: {output_file}\n")

    # Extract enrichments
    enrichments = extract_all_schemas(input_file)

    # Save to file
    save_enrichments(enrichments, output_file)

    # Generate and display statistics
    stats = generate_statistics(enrichments)

    logger.info(f"\n{'='*60}")
    logger.info("EXTRACTION STATISTICS")
    logger.info(f"{'='*60}")
    logger.info(f"Total APIs extracted: {stats['total_apis']}")
    logger.info(f"Total required parameters: {stats['total_required_parameters']} (avg {stats['average_required_per_api']}/API)")
    logger.info(f"Total optional parameters: {stats['total_optional_parameters']} (avg {stats['average_optional_per_api']}/API)")
    logger.info(f"Total output fields: {stats['total_output_fields']} (avg {stats['average_output_fields_per_api']}/API)")
    logger.info(f"APIs with no required params: {stats['apis_with_no_required_params']}")
    logger.info(f"APIs with 10+ total params: {stats['apis_with_10_plus_params']}")
    logger.info(f"{'='*60}\n")

    # Save statistics
    stats_file = output_file.replace('.json', '_statistics.json')
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    logger.info(f"Statistics saved to {stats_file}")

    logger.info("✅ Phase 1 complete! Ready for Phase 2: Skill enrichment linking")

    return enrichments, stats


if __name__ == '__main__':
    import sys

    input_file = sys.argv[1] if len(sys.argv) > 1 else 'D:/Tastemaker_bot/mcp_server/data/xsd_schemas/api_schemas.json'
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'D:/Tastemaker_bot/mcp_server/tools/schema_enrichment_metadata.json'

    enrichments, stats = main(input_file, output_file)
