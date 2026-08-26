#!/usr/bin/env python3
"""Direct test of KG initialization."""

import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Add kg_layer to path
sys.path.insert(0, str(Path(__file__).parent))

logger.info("=" * 60)
logger.info("Testing Knowledge Graph Initialization")
logger.info("=" * 60)

try:
    logger.info("Importing kg_layer...")
    from kg_layer import initialize_kg
    logger.info("✓ kg_layer imported successfully")

    logger.info("Calling initialize_kg()...")
    success, message = initialize_kg(force_reset=False)

    if success:
        logger.info(f"✓ SUCCESS: {message}")
    else:
        logger.error(f"✗ FAILED: {message}")
        sys.exit(1)

except ImportError as e:
    logger.error(f"✗ ImportError: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    logger.error(f"✗ Exception: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

logger.info("=" * 60)
logger.info("Test completed successfully")
logger.info("=" * 60)
