"""Static OMS schema resources exposed via MCP."""

_ORDERS_SCHEMA = """# OMS Orders Schema

## Table: orders

| Column         | Type      | Nullable | Notes                          |
|----------------|-----------|----------|--------------------------------|
| id             | UUID      | No       | Primary key                    |
| customer_id    | UUID      | No       | FK → customers.id              |
| status         | String    | No       | pending/confirmed/shipped/delivered/cancelled |
| subtotal       | Float     | No       | Line items total (pre-tax)     |
| tax_amount     | Float     | No       | Calculated tax                 |
| shipping_cost  | Float     | No       | Shipping fee                   |
| total_amount   | Float     | No       | subtotal + tax + shipping      |
| currency       | String    | No       | ISO 4217 code, e.g. "USD"      |
| shipping_address_id | UUID | No      | FK → addresses.id              |
| notes          | Text      | Yes      | Internal notes                 |
| placed_at      | DateTime  | No       | When the order was submitted   |
| created_at     | DateTime  | No       | Record creation timestamp      |
| updated_at     | DateTime  | No       | Last modification timestamp    |

## Relationships
- **order_items** (1:N) → order_items.order_id
- **shipments** (1:N) → shipments.order_id
- **customer** (N:1) → customers.id
- **shipping_address** (N:1) → addresses.id

## Status State Machine
```
pending → confirmed → processing → shipped → delivered
       ↘                                   ↗
         cancelled ←─────────────────────
```

## Indexes
- `(customer_id, status)` — customer order history queries
- `(status, placed_at)` — operational dashboard queries
"""

_PRODUCTS_SCHEMA = """# OMS Products Schema

## Table: products

| Column          | Type    | Nullable | Notes                          |
|-----------------|---------|----------|--------------------------------|
| id              | UUID    | No       | Primary key                    |
| sku             | String  | No       | Unique stock-keeping unit      |
| name            | String  | No       | Display name                   |
| description     | Text    | Yes      | Long-form product description  |
| category_id     | UUID    | Yes      | FK → categories.id             |
| brand           | String  | Yes      |                                |
| base_price      | Float   | No       | Default retail price           |
| cost_price      | Float   | Yes      | COGS                           |
| weight_grams    | Integer | Yes      | For shipping calculations      |
| is_active       | Boolean | No       | Soft-delete / visibility flag  |
| created_at      | DateTime| No       |                                |
| updated_at      | DateTime| No       |                                |

## Relationships
- **product_variants** (1:N) → product_variants.product_id
- **inventory_items** (1:N) via product_variants
- **order_items** (1:N) → order_items.product_id

## Notes
- Use `product_variants` for size/color combinations (each variant has its own SKU)
- `base_price` is the default; variant-level pricing overrides it
"""

_INVENTORY_SCHEMA = """# OMS Inventory Schema

## Table: inventory_items

| Column           | Type    | Nullable | Notes                        |
|------------------|---------|----------|------------------------------|
| id               | UUID    | No       | Primary key                  |
| product_variant_id | UUID  | No       | FK → product_variants.id     |
| warehouse_id     | UUID    | No       | FK → warehouses.id           |
| quantity_on_hand | Integer | No       | Physical stock count         |
| quantity_reserved| Integer | No       | Held by pending orders       |
| quantity_available| Integer| No       | on_hand - reserved           |
| reorder_point    | Integer | No       | Triggers restock alert       |
| reorder_quantity | Integer | No       | Amount to reorder            |
| created_at       | DateTime| No       |                              |
| updated_at       | DateTime| No       |                              |

## Table: stock_movements

| Column           | Type    | Nullable | Notes                        |
|------------------|---------|----------|------------------------------|
| id               | UUID    | No       | Primary key                  |
| inventory_item_id| UUID    | No       | FK → inventory_items.id      |
| type             | String  | No       | receipt/shipment/adjustment/return |
| quantity_delta   | Integer | No       | Positive = inbound, negative = outbound |
| reference_type   | String  | Yes      | "order", "purchase_order", "manual" |
| reference_id     | UUID    | Yes      | ID of the referenced entity  |
| notes            | Text    | Yes      |                              |
| occurred_at      | DateTime| No       |                              |

## Business Rules
- `quantity_available` must never go negative (enforce at application layer)
- Reservation happens at order confirmation; release on cancellation or fulfillment
- All changes go through `stock_movements` for a full audit trail
"""

_CUSTOMERS_SCHEMA = """# OMS Customers Schema

## Table: customers

| Column          | Type    | Nullable | Notes                          |
|-----------------|---------|----------|--------------------------------|
| id              | UUID    | No       | Primary key                    |
| email           | String  | No       | Unique, used for login         |
| first_name      | String  | No       |                                |
| last_name       | String  | No       |                                |
| phone           | String  | Yes      |                                |
| is_guest        | Boolean | No       | Guest checkout vs. account     |
| lifetime_value  | Float   | No       | Running total of order spend   |
| tags            | Text    | Yes      | Comma-separated labels         |
| created_at      | DateTime| No       |                                |
| updated_at      | DateTime| No       |                                |

## Table: addresses

| Column          | Type    | Nullable | Notes                          |
|-----------------|---------|----------|--------------------------------|
| id              | UUID    | No       | Primary key                    |
| customer_id     | UUID    | No       | FK → customers.id              |
| label           | String  | Yes      | "home", "office", etc.         |
| line1           | String  | No       |                                |
| line2           | String  | Yes      |                                |
| city            | String  | No       |                                |
| state           | String  | No       | State/Province code            |
| postal_code     | String  | No       |                                |
| country         | String  | No       | ISO 3166-1 alpha-2             |
| is_default      | Boolean | No       | Default shipping address       |

## Relationships
- **orders** (1:N) → orders.customer_id
- **addresses** (1:N) → addresses.customer_id
"""

_FULFILLMENT_SCHEMA = """# OMS Fulfillment Schema

## Table: shipments

| Column          | Type    | Nullable | Notes                          |
|-----------------|---------|----------|--------------------------------|
| id              | UUID    | No       | Primary key                    |
| order_id        | UUID    | No       | FK → orders.id                 |
| warehouse_id    | UUID    | No       | FK → warehouses.id             |
| carrier         | String  | No       | UPS, FedEx, USPS, DHL, etc.    |
| tracking_number | String  | Yes      | Carrier tracking ID            |
| status          | String  | No       | pending/packed/shipped/delivered/exception |
| shipped_at      | DateTime| Yes      | When handed to carrier         |
| estimated_delivery| DateTime| Yes   |                                |
| delivered_at    | DateTime| Yes      |                                |
| weight_grams    | Integer | Yes      | Actual shipped weight          |
| label_url       | String  | Yes      | URL to shipping label PDF      |
| created_at      | DateTime| No       |                                |
| updated_at      | DateTime| No       |                                |

## Table: shipment_items

| Column          | Type    | Nullable | Notes                          |
|-----------------|---------|----------|--------------------------------|
| id              | UUID    | No       | Primary key                    |
| shipment_id     | UUID    | No       | FK → shipments.id              |
| order_item_id   | UUID    | No       | FK → order_items.id            |
| quantity        | Integer | No       | Units in this shipment         |

## Fulfillment Flow
1. Order confirmed → fulfillment job queued
2. Warehouse picks items → inventory_items.quantity_reserved decreases
3. Packed → shipment created with `status = packed`
4. Label generated → tracking_number populated
5. Carrier pickup → `status = shipped`, `shipped_at` set
6. Delivery confirmed → `status = delivered`, `delivered_at` set
"""


_ARCHITECTURE_DOC = """# OMS Architecture Overview

## Technology Stack
- **API**: FastAPI (async) + Uvicorn
- **ORM**: SQLAlchemy 2.x (async)
- **Database**: PostgreSQL 16
- **Migrations**: Alembic
- **Cache**: Redis (session, rate limiting)
- **Message Queue**: RabbitMQ (async fulfillment events)
- **Containerization**: Docker + docker-compose

## Service Boundaries

```
                 ┌─────────────────────────────────┐
                 │           API Gateway            │
                 │         (FastAPI main)           │
                 └────┬────────┬────────┬───────────┘
                      │        │        │
          ┌───────────┘   ┌────┘    ┌───┘
          ▼               ▼         ▼
   ┌─────────────┐ ┌──────────┐ ┌──────────────┐
   │  Order Svc  │ │ Product  │ │ Customer Svc │
   │             │ │   Svc    │ │              │
   └──────┬──────┘ └────┬─────┘ └──────┬───────┘
          │             │              │
          └─────────────┼──────────────┘
                        ▼
                 ┌─────────────┐
                 │  PostgreSQL │
                 └─────────────┘
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
   ┌────────────┐ ┌──────────┐ ┌────────────┐
   │ Inventory  │ │ Fulfill- │ │ Notification│
   │   Svc      │ │ ment Svc │ │    Svc     │
   └────────────┘ └──────────┘ └────────────┘
```

## Module Structure (per service)
```
{service}/
├── model.py        # SQLAlchemy ORM model
├── schemas.py      # Pydantic request/response models
├── router.py       # FastAPI route handlers
├── service.py      # Business logic
└── __init__.py
```

## Key Design Principles
1. **Async everywhere** — all DB calls use `async with session` patterns
2. **Schema-first** — Pydantic schemas validated before any DB write
3. **Audit trail** — all mutations recorded in audit log table
4. **Idempotency** — order creation accepts a `client_reference_id` to prevent duplicate orders
5. **Soft deletes** — records are never hard-deleted; use `is_active = False`
"""


def register_schema_resources(mcp):
    @mcp.resource("oms://schema/orders")
    def orders_schema() -> str:
        """E-commerce order schema with fields, relationships, and state machine."""
        return _ORDERS_SCHEMA

    @mcp.resource("oms://schema/products")
    def products_schema() -> str:
        """Product catalog schema including variant and pricing structure."""
        return _PRODUCTS_SCHEMA

    @mcp.resource("oms://schema/inventory")
    def inventory_schema() -> str:
        """Inventory and stock movement schema with business rules."""
        return _INVENTORY_SCHEMA

    @mcp.resource("oms://schema/customers")
    def customers_schema() -> str:
        """Customer and address schema."""
        return _CUSTOMERS_SCHEMA

    @mcp.resource("oms://schema/fulfillment")
    def fulfillment_schema() -> str:
        """Shipment and fulfillment schema with flow description."""
        return _FULFILLMENT_SCHEMA

    @mcp.resource("oms://docs/architecture")
    def architecture_doc() -> str:
        """OMS architecture overview: stack, service boundaries, module structure."""
        return _ARCHITECTURE_DOC
