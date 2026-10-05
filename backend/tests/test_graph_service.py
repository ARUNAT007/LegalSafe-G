import pytest
from services.graph_service import GraphService
from models.legal_fact import LegalFact

def test_build_empty():
    svc = GraphService()
    g = svc.build_graph([])
    assert g.node_count() == 0

def test_build_with_amount():
    svc = GraphService()
    f = LegalFact(clause_id="1", amount="$100")
    g = svc.build_graph([f])
    assert len(g.get_all_amounts()) == 1

def test_build_with_party():
    svc = GraphService()
    f = LegalFact(clause_id="1", subject="Tenant")
    g = svc.build_graph([f])
    assert len(g.get_all_parties()) == 1

def test_graph_serialization():
    svc = GraphService()
    f = LegalFact(clause_id="1", amount="$100")
    g = svc.build_graph([f])
    j = svc.serialize_graph(g)
    g2 = svc.deserialize_graph(j)
    assert g2.node_count() == g.node_count()

def test_graph_summary():
    svc = GraphService()
    f = LegalFact(clause_id="1", amount="$100")
    g = svc.build_graph([f])
    summary = svc.get_graph_summary(g)
    assert summary['amounts'] == 1
