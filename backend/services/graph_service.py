import logging
from typing import List, Dict, Any
import networkx as nx
from models.legal_graph import LegalGraph
from models.legal_fact import LegalFact

logger = logging.getLogger(__name__)

class GraphService:
    """Service to build and manipulate NetworkX graphs from LegalFacts."""
    
    def build_graph(self, facts: List[LegalFact]) -> LegalGraph:
        """
        Builds a NetworkX DiGraph dynamically from a list of LegalFacts extracted from the uploaded document.
        No predefined or hardcoded nodes are used.
        """
        graph = LegalGraph()
        
        for fact in facts:
            clause_id = fact.clause_id or "1"
            clause_node = f"Clause_{clause_id}"
            source_text = fact.source_text or ""
            
            graph.add_entity_node(
                clause_node,
                label=f"Clause {clause_id}",
                node_type="clause",
                source_text=source_text
            )
            
            # 1. Subject Node (Party / Person / Organization)
            subj_node = None
            if fact.subject:
                subj_node = f"Subj_{fact.subject}_{clause_id}"
                graph.add_entity_node(
                    subj_node,
                    label=fact.subject,
                    node_type="party",
                    source_text=source_text
                )
                graph.add_edge(clause_node, subj_node, relation="APPLIES_TO", source_text=source_text)

            # 2. Determine Focal Node & Action/Modality Edge
            focal_node = subj_node or clause_node
            
            # Action Relation (MUST_PAY, MUST_SUBMIT, MAY_INSPECT, MUST_NOT_SUBLEASE, etc.)
            modality = (fact.modality or "").upper()
            action = (fact.action or "").upper()
            
            if modality and action:
                action_relation = f"{modality}_{action}"
            elif modality:
                action_relation = modality
            elif action:
                action_relation = action
            else:
                action_relation = "APPLIES_TO"

            if fact.obj:
                obj_node = f"Obj_{fact.obj}_{clause_id}"
                graph.add_entity_node(
                    obj_node,
                    label=fact.obj,
                    node_type="object",
                    source_text=source_text
                )
                graph.add_edge(focal_node, obj_node, relation=action_relation, source_text=source_text)
                focal_node = obj_node
            elif fact.action:
                act_node = f"Act_{fact.action}_{clause_id}"
                graph.add_entity_node(
                    act_node,
                    label=fact.action,
                    node_type="action",
                    source_text=source_text
                )
                graph.add_edge(focal_node, act_node, relation=action_relation, source_text=source_text)
                focal_node = act_node

            # 3. Dynamic Attribute Nodes
            # Financial Amounts
            if fact.amount:
                amt_node = f"Amt_{fact.amount}_{clause_id}"
                graph.add_entity_node(
                    amt_node,
                    label=fact.amount,
                    node_type="amount",
                    source_text=source_text
                )
                amt_relation = "PAYS" if "pay" in (fact.action or "").lower() else "HAS_AMOUNT"
                graph.add_edge(focal_node, amt_node, relation=amt_relation, source_text=source_text)

            # Frequency
            if fact.frequency:
                freq_node = f"Freq_{fact.frequency}_{clause_id}"
                graph.add_entity_node(
                    freq_node,
                    label=fact.frequency,
                    node_type="frequency",
                    source_text=source_text
                )
                graph.add_edge(focal_node, freq_node, relation="FREQUENCY", source_text=source_text)

            # Deadlines & Durations
            deadline_val = fact.deadline or fact.duration
            if deadline_val:
                dead_node = f"Dead_{deadline_val}_{clause_id}"
                graph.add_entity_node(
                    dead_node,
                    label=deadline_val,
                    node_type="deadline",
                    source_text=source_text
                )
                graph.add_edge(focal_node, dead_node, relation="WITHIN", source_text=source_text)

            # Percentage
            if fact.percentage:
                pct_node = f"Pct_{fact.percentage}_{clause_id}"
                graph.add_entity_node(
                    pct_node,
                    label=fact.percentage,
                    node_type="amount",
                    source_text=source_text
                )
                graph.add_edge(focal_node, pct_node, relation="APPLIES_TO", source_text=source_text)

            # Conditions
            conditions = fact.conditions or ([fact.condition] if fact.condition else [])
            for idx, cond in enumerate(conditions):
                cond_node = f"Cond_{clause_id}_{idx}"
                graph.add_entity_node(
                    cond_node,
                    label=cond,
                    node_type="condition",
                    source_text=source_text
                )
                graph.add_edge(focal_node, cond_node, relation="CONDITIONAL_ON", source_text=source_text)

            # Exceptions
            exceptions = fact.exceptions or ([fact.exception] if fact.exception else [])
            for idx, exc in enumerate(exceptions):
                exc_node = f"Exc_{clause_id}_{idx}"
                graph.add_entity_node(
                    exc_node,
                    label=exc,
                    node_type="exception",
                    source_text=source_text
                )
                graph.add_edge(focal_node, exc_node, relation="EXCEPT", source_text=source_text)

            # Penalties
            if fact.penalty:
                pen_node = f"Pen_{fact.penalty}_{clause_id}"
                graph.add_entity_node(
                    pen_node,
                    label=fact.penalty,
                    node_type="penalty",
                    source_text=source_text
                )
                graph.add_edge(focal_node, pen_node, relation="PROHIBITED", source_text=source_text)

            # Other Parties / Payees
            if fact.parties:
                for party in fact.parties:
                    if fact.subject and party.lower() == fact.subject.lower():
                        continue
                    other_party_node = f"Party_{party}_{clause_id}"
                    graph.add_entity_node(
                        other_party_node,
                        label=party,
                        node_type="party",
                        source_text=source_text
                    )
                    graph.add_edge(focal_node, other_party_node, relation="RECEIVES", source_text=source_text)

        return graph

    def serialize_graph(self, graph: LegalGraph) -> dict:
        """Return graph as a plain dict (not JSON string) for API serialization."""
        return graph.to_dict()

    def deserialize_graph(self, data: Any) -> LegalGraph:
        if isinstance(data, dict):
            return LegalGraph.from_dict(data)
        elif isinstance(data, str):
            return LegalGraph.from_json(data)
        return LegalGraph.from_dict(data)

    def get_graph_summary(self, graph: LegalGraph) -> Dict[str, int]:
        return {
            'nodes': graph.node_count(),
            'edges': graph.edge_count(),
            'amounts': len(graph.get_all_amounts()),
            'parties': len(graph.get_all_parties()),
            'deadlines': len(graph.get_all_deadlines())
        }
