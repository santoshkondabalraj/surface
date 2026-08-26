#!/usr/bin/env python3
"""One-time Knowledge Graph setup script."""

import logging
from kg_layer import initialize_kg

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    print("=" * 60)
    print("Initializing Knowledge Graph")
    print("=" * 60)

    success, message = initialize_kg(force_reset=False)

    if success:
        print(f"✓ SUCCESS: {message}")
    else:
        print(f"✗ FAILED: {message}")
        exit(1)
