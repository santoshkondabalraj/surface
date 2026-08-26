"""Neo4J Knowledge Graph Client - Connection, transactions, CRUD operations."""

import os
from pathlib import Path
from typing import Optional, List, Dict, Any
from neo4j import GraphDatabase, Session, Transaction
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)


class Neo4JClient:
    """Client for Neo4J Knowledge Graph operations."""

    def __init__(self, uri: Optional[str] = None, user: Optional[str] = None, password: Optional[str] = None, database: str = "neo4j"):
        """
        Initialize Neo4J client.

        Args:
            uri: Neo4J connection URI (reads from NEO4J_URI env var if not provided)
            user: Neo4J username (reads from NEO4J_USER env var if not provided)
            password: Neo4J password (reads from NEO4J_PASSWORD env var if not provided)
            database: Database name (default: neo4j)
        """
        # Load env from frontend/.env
        env_path = Path(__file__).parent.parent.parent / "frontend" / ".env"
        load_dotenv(dotenv_path=env_path)

        self.uri = uri or os.getenv("NEO4J_URI")
        self.user = user or os.getenv("NEO4J_USERNAME")
        self.password = password or os.getenv("NEO4J_PASSWORD")
        self.database = database

        if not all([self.uri, self.user, self.password]):
            raise ValueError(
                "Neo4J connection credentials not provided. "
                "Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD in .env"
            )

        self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
        logger.info(f"[Neo4J] Driver created for {self.uri}")

        # Verify connection immediately
        try:
            with self.driver.session(database=self.database) as session:
                session.run("RETURN 1")
            logger.info(f"[Neo4J] Connection verified successfully")
        except Exception as e:
            logger.error(f"[Neo4J] Connection verification failed: {e}")
            self.driver.close()
            raise

    def close(self):
        """Close driver connection."""
        if self.driver:
            self.driver.close()
            logger.info("[Neo4J] Connection closed")

    def verify_connection(self) -> bool:
        """Verify connection to Neo4J."""
        try:
            with self.driver.session(database=self.database) as session:
                result = session.run("RETURN 1")
                result.consume()
            logger.info("[Neo4J] Connection verified")
            return True
        except Exception as e:
            logger.error(f"[Neo4J] Connection failed: {e}")
            return False

    def run_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Execute a query and return results.

        Args:
            query: Cypher query
            parameters: Query parameters

        Returns:
            List of result records as dicts
        """
        with self.driver.session(database=self.database) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def create_node(self, label: str, properties: Dict[str, Any]) -> Optional[str]:
        """
        Create a node.

        Args:
            label: Node label (e.g., "ORDER")
            properties: Node properties

        Returns:
            Node ID (internal neo4j id)
        """
        query = f"""
        CREATE (n:{label} $props)
        RETURN id(n) as node_id
        """
        try:
            result = self.run_query(query, {"props": properties})
            if result:
                return str(result[0]['node_id'])
        except Exception as e:
            logger.error(f"[Neo4J] Failed to create {label} node: {e}")
            return None

    def create_relationship(self, source_label: str, source_id: str, target_label: str, target_id: str, rel_name: str, properties: Optional[Dict[str, Any]] = None) -> bool:
        """
        Create a relationship between two nodes.

        Args:
            source_label: Source node label
            source_id: Source node ID (business key)
            target_label: Target node label
            target_id: Target node ID (business key)
            rel_name: Relationship name
            properties: Relationship properties

        Returns:
            True if successful, False otherwise
        """
        query = f"""
        MATCH (source:{source_label} {{id: $source_id}})
        MATCH (target:{target_label} {{id: $target_id}})
        CREATE (source)-[r:{rel_name} $props]->(target)
        RETURN r
        """
        try:
            params = {
                "source_id": source_id,
                "target_id": target_id,
                "props": properties or {}
            }
            result = self.run_query(query, params)
            return bool(result)
        except Exception as e:
            logger.error(f"[Neo4J] Failed to create {rel_name} relationship: {e}")
            return False

    def find_node(self, label: str, properties: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Find a single node by properties.

        Args:
            label: Node label
            properties: Search properties

        Returns:
            Node data or None
        """
        props_str = ", ".join([f"{k}: ${k}" for k in properties.keys()])
        query = f"MATCH (n:{label} {{{props_str}}}) RETURN properties(n) as data"
        try:
            result = self.run_query(query, properties)
            return result[0]['data'] if result else None
        except Exception as e:
            logger.error(f"[Neo4J] Failed to find {label} node: {e}")
            return None

    def find_nodes(self, label: str, properties: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Find nodes by label and optional properties.

        Args:
            label: Node label
            properties: Optional search properties

        Returns:
            List of node data
        """
        if properties:
            props_str = ", ".join([f"{k}: ${k}" for k in properties.keys()])
            query = f"MATCH (n:{label} {{{props_str}}}) RETURN properties(n) as data"
        else:
            query = f"MATCH (n:{label}) RETURN properties(n) as data"

        try:
            result = self.run_query(query, properties or {})
            return [r['data'] for r in result]
        except Exception as e:
            logger.error(f"[Neo4J] Failed to find {label} nodes: {e}")
            return []

    def update_node(self, label: str, id_prop: str, id_value: str, updates: Dict[str, Any]) -> bool:
        """
        Update node properties.

        Args:
            label: Node label
            id_prop: Property name used as identifier (e.g., "order_header_key")
            id_value: Value of identifier
            updates: Properties to update

        Returns:
            True if successful
        """
        set_clause = ", ".join([f"n.{k} = ${k}" for k in updates.keys()])
        query = f"MATCH (n:{label} {{{id_prop}: ${id_prop}}}) SET {set_clause} RETURN n"

        try:
            params = {id_prop: id_value}
            params.update(updates)
            result = self.run_query(query, params)
            return bool(result)
        except Exception as e:
            logger.error(f"[Neo4J] Failed to update {label} node: {e}")
            return False

    def delete_node(self, label: str, id_prop: str, id_value: str) -> bool:
        """
        Delete a node (detaches relationships).

        Args:
            label: Node label
            id_prop: Property name used as identifier
            id_value: Value of identifier

        Returns:
            True if successful
        """
        query = f"MATCH (n:{label} {{{id_prop}: ${id_prop}}}) DETACH DELETE n"
        try:
            self.run_query(query, {id_prop: id_value})
            return True
        except Exception as e:
            logger.error(f"[Neo4J] Failed to delete {label} node: {e}")
            return False

    def clear_all(self) -> bool:
        """
        Delete all nodes and relationships (DANGEROUS - use for testing only).

        Returns:
            True if successful
        """
        query = "MATCH (n) DETACH DELETE n"
        try:
            self.run_query(query)
            logger.warning("[Neo4J] ALL NODES DELETED")
            return True
        except Exception as e:
            logger.error(f"[Neo4J] Failed to clear database: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get KG statistics."""
        queries = {
            "total_nodes": "MATCH (n) RETURN count(n) as count",
            "total_relationships": "MATCH ()-[r]->() RETURN count(r) as count",
            "nodes_by_label": "MATCH (n) RETURN labels(n)[0] as label, count(*) as count",
        }
        stats = {}
        for key, query in queries.items():
            try:
                result = self.run_query(query)
                if key == "nodes_by_label":
                    stats[key] = {r['label']: r['count'] for r in result}
                else:
                    stats[key] = result[0]['count'] if result else 0
            except Exception as e:
                logger.error(f"[Neo4J] Failed to get {key}: {e}")
        return stats
