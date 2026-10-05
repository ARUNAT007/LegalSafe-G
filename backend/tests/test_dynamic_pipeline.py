import pytest
from services.extraction_service import ExtractionService
from services.graph_service import GraphService

def test_dynamic_fact_and_graph_extraction():
    extract_svc = ExtractionService()
    graph_svc = GraphService()

    # Document A (Rental Agreement)
    doc_a_text = "The tenant shall pay ₹15,000 monthly to the landlord by the 5th day of each month."
    fact_a = extract_svc.extract("c1", doc_a_text)

    assert fact_a.subject in ["Tenant", "tenant"]
    assert fact_a.amount == "₹15,000"
    assert fact_a.frequency in ["Monthly", "monthly"]
    assert "Landlord" in fact_a.parties or "landlord" in fact_a.parties or "Tenant" in fact_a.parties
    assert fact_a.source_text == doc_a_text

    graph_a = graph_svc.build_graph([fact_a])
    nodes_a = [d.get("label") for _, d in graph_a.graph.nodes(data=True)]

    # Document B (Employment Report)
    doc_b_text = "The employee shall submit the report within 10 days."
    fact_b = extract_svc.extract("c1", doc_b_text)

    assert fact_b.subject in ["Employee", "employee"]
    assert fact_b.action in ["submit", "Submit"]
    assert fact_b.deadline == "within 10 days"
    assert fact_b.amount is None
    assert fact_b.source_text == doc_b_text

    graph_b = graph_svc.build_graph([fact_b])
    nodes_b = [d.get("label") for _, d in graph_b.graph.nodes(data=True)]

    # Assert Graph A != Graph B
    assert nodes_a != nodes_b

    # Assert Document B contains NO Tenant, Landlord, or ₹15,000
    assert "Tenant" not in nodes_b
    assert "Landlord" not in nodes_b
    assert "₹15,000" not in nodes_b

def test_no_sample_fallback_on_invalid_text():
    from services.document_service import DocumentService
    doc_svc = DocumentService()
    
    # Non-existent extension or empty text should raise ValueError or FileNotFoundError, NOT load sample docs
    with pytest.raises((ValueError, FileNotFoundError)):
        doc_svc.extract("invalid_file.xyz")
