"""Neo4J Knowledge Graph ORM - Entity models for Order Management ontology."""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field


@dataclass
class Order:
    """ORDER entity - root of order lifecycle."""
    order_header_key: str
    order_no: str
    enterprise_key: str
    document_type: str = "0001"
    order_date: Optional[str] = None
    payment_status: Optional[str] = None
    total_amount: Optional[float] = None
    customer_emailid: Optional[str] = None
    customer_phone_no: Optional[str] = None
    order_type: Optional[str] = None
    neo4j_id: Optional[str] = field(default=None, init=False)


@dataclass
class OrderLine:
    """ORDER_LINE entity - individual item within order."""
    order_line_key: str
    order_header_key: str
    prime_line_no: int
    sub_line_no: int = 1
    item_id: str = ""
    item_desc: Optional[str] = None
    ordered_qty: float = 0.0
    unit_price: Optional[float] = None
    uom: Optional[str] = None
    line_type: Optional[str] = None
    neo4j_id: Optional[str] = field(default=None, init=False)


@dataclass
class OrderRelease:
    """ORDER_RELEASE entity - shipment schedule for order lines."""
    order_release_key: str
    order_header_key: str
    order_line_key: Optional[str] = None
    release_no: Optional[int] = None
    shipnode_key: Optional[str] = None
    req_ship_date: Optional[str] = None
    req_delivery_date: Optional[str] = None
    status: Optional[str] = None
    neo4j_id: Optional[str] = field(default=None, init=False)


@dataclass
class Shipment:
    """SHIPMENT entity - physical shipment of goods."""
    shipment_key: str
    shipment_no: str
    order_header_key: str
    scac: Optional[str] = None
    carrier_service_code: Optional[str] = None
    origin_port: Optional[str] = None
    dest_port: Optional[str] = None
    ship_date: Optional[str] = None
    actual_shipment_date: Optional[str] = None
    status: Optional[str] = None
    neo4j_id: Optional[str] = field(default=None, init=False)


@dataclass
class ShipmentLine:
    """SHIPMENT_LINE entity - item within shipment (bridge to orders)."""
    shipment_line_key: str
    shipment_key: str
    order_line_key: str
    quantity: float
    order_header_key: Optional[str] = None
    order_release_key: Optional[str] = None
    item_id: Optional[str] = None
    neo4j_id: Optional[str] = field(default=None, init=False)


@dataclass
class ShipmentContainer:
    """SHIPMENT_CONTAINER entity - physical container/box."""
    shipment_container_key: str
    shipment_key: str
    container_no: Optional[str] = None
    neo4j_id: Optional[str] = field(default=None, init=False)


@dataclass
class Exception:
    """EXCEPTION entity - integration errors/diagnostics."""
    errortxnid: str
    flow_name: str
    errorcode: Optional[str] = None
    errorstring: Optional[str] = None
    message: Optional[str] = None
    error_reference: Optional[str] = None
    state: Optional[str] = None
    createts: Optional[str] = None
    neo4j_id: Optional[str] = field(default=None, init=False)


# Entity metadata for KG setup
ENTITY_TYPES = {
    "ORDER": Order,
    "ORDER_LINE": OrderLine,
    "ORDER_RELEASE": OrderRelease,
    "SHIPMENT": Shipment,
    "SHIPMENT_LINE": ShipmentLine,
    "SHIPMENT_CONTAINER": ShipmentContainer,
    "EXCEPTION": Exception,
}

# Relationship definitions
RELATIONSHIPS = [
    {"source": "ORDER", "target": "ORDER_LINE", "name": "HAS_LINE", "cardinality": "1:N"},
    {"source": "ORDER", "target": "ORDER_RELEASE", "name": "HAS_RELEASE", "cardinality": "1:N"},
    {"source": "ORDER", "target": "SHIPMENT", "name": "HAS_SHIPMENT", "cardinality": "1:N"},
    {"source": "ORDER_LINE", "target": "ORDER_RELEASE", "name": "ALLOCATED_TO", "cardinality": "N:1"},
    {"source": "ORDER_LINE", "target": "SHIPMENT_LINE", "name": "FULFILLED_BY", "cardinality": "1:N"},
    {"source": "SHIPMENT", "target": "SHIPMENT_LINE", "name": "HAS_LINE", "cardinality": "1:N"},
    {"source": "SHIPMENT", "target": "SHIPMENT_CONTAINER", "name": "HAS_CONTAINER", "cardinality": "1:N"},
    {"source": "SHIPMENT_CONTAINER", "target": "SHIPMENT_LINE", "name": "CONTAINS", "cardinality": "N:N"},
    {"source": "EXCEPTION", "target": "ORDER", "name": "AFFECTS_ORDER", "cardinality": "N:1"},
    {"source": "EXCEPTION", "target": "SHIPMENT", "name": "AFFECTS_SHIPMENT", "cardinality": "N:1"},
]

# Supported operations per entity
OPERATIONS = {
    "ORDER": ["Create", "Read", "Update"],
    "ORDER_LINE": ["Create", "Read", "Update"],
    "ORDER_RELEASE": ["Create", "Read", "Update"],
    "SHIPMENT": ["Create", "Read", "Update"],
    "SHIPMENT_LINE": ["Create", "Read"],
    "SHIPMENT_CONTAINER": ["Create", "Read"],
    "EXCEPTION": ["Create", "Read", "Update"],
}
