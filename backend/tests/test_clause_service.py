import pytest
from services.clause_service import ClauseService

def test_empty_text():
    svc = ClauseService()
    assert svc.segment("") == []

def test_numbered_clauses():
    svc = ClauseService()
    text = "1. First clause\n\n2. Second clause"
    clauses = svc.segment(text)
    assert len(clauses) == 2
    assert clauses[0]['clause_id'] == '1.'

def test_article_clauses():
    svc = ClauseService()
    text = "Article 1\nContent of article 1."
    clauses = svc.segment(text)
    assert clauses[0]['clause_id'] == 'Article 1'

def test_heading_preservation():
    svc = ClauseService()
    text = "GENERAL PROVISIONS\n\n1. First"
    clauses = svc.segment(text)
    assert clauses[0]['section'] == 'GENERAL PROVISIONS'

def test_fallback_segmentation():
    svc = ClauseService()
    text = "Just a random paragraph."
    clauses = svc.segment(text)
    assert len(clauses) == 1
    assert "clause_" in clauses[0]['clause_id']
