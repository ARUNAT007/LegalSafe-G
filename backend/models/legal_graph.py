import json
import networkx as nx
from typing import Dict, Any, List

class LegalGraph:
    """Wrapper class for NetworkX DiGraph representing a legal fact graph."""
    
    def __init__(self, graph: nx.DiGraph = None):
        """Initialize with an existing NetworkX graph or create a new one."""
        self.graph = graph if graph is not None else nx.DiGraph()

    def add_entity_node(self, node_id: str, label: str, node_type: str, **attributes):
        """Add an entity node to the graph."""
        self.graph.add_node(node_id, label=label, type=node_type, **attributes)

    def add_edge(self, source: str, target: str, relation: str, **attributes):
        """Add a directed edge between two nodes."""
        self.graph.add_edge(source, target, relation=relation, **attributes)

    def to_dict(self) -> dict:
        """Convert graph to a node-link dictionary format."""
        return nx.node_link_data(self.graph)

    @classmethod
    def from_dict(cls, data: dict) -> 'LegalGraph':
        """Create a LegalGraph from a node-link dictionary."""
        return cls(nx.node_link_graph(data))

    def to_json(self) -> str:
        """Convert graph to a JSON string."""
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> 'LegalGraph':
        """Create a LegalGraph from a JSON string."""
        data = json.loads(json_str)
        return cls.from_dict(data)

    def _get_nodes_by_type(self, node_type: str) -> List[Dict[str, Any]]:
        """Helper to get all nodes of a specific type."""
        return [{'id': n, **d} for n, d in self.graph.nodes(data=True) if d.get('type') == node_type]

    def get_all_amounts(self) -> List[Dict[str, Any]]:
        return self._get_nodes_by_type('amount')

    def get_all_deadlines(self) -> List[Dict[str, Any]]:
        return self._get_nodes_by_type('deadline')

    def get_all_modalities(self) -> List[Dict[str, Any]]:
        return self._get_nodes_by_type('modality')

    def get_all_parties(self) -> List[Dict[str, Any]]:
        return self._get_nodes_by_type('party')

    def get_all_penalties(self) -> List[Dict[str, Any]]:
        return self._get_nodes_by_type('penalty')

    def node_count(self) -> int:
        """Return the number of nodes in the graph."""
        return self.graph.number_of_nodes()

    def edge_count(self) -> int:
        """Return the number of edges in the graph."""
        return self.graph.number_of_edges()
