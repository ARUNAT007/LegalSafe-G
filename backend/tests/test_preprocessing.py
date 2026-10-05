import pytest
from services.preprocessing_service import PreprocessingService

def test_normalize_whitespace():
    svc = PreprocessingService()
    assert svc.preprocess("  Hello \n  world  ") == "Hello world"

def test_preserve_amount():
    svc = PreprocessingService()
    assert "₹50,000" in svc.preprocess("The fee is ₹50,000.")

def test_preserve_date():
    svc = PreprocessingService()
    assert "01/01/2024" in svc.preprocess("Start date 01/01/2024")

def test_preserve_negation():
    svc = PreprocessingService()
    assert "notwithstanding" in svc.preprocess("notwithstanding the above")

def test_difficult_terms():
    svc = PreprocessingService()
    terms = svc.get_difficult_terms()
    assert "indemnify" in terms
    assert "liability" in terms
