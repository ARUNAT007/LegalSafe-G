import pytest
from services.extraction_service import ExtractionService

@pytest.fixture(scope="module")
def extractor():
    return ExtractionService()

def test_extract_amount(extractor):
    fact = extractor.extract("1", "The tenant shall pay $500 monthly.")
    assert fact.amount == "$500"

def test_extract_modality_must(extractor):
    fact = extractor.extract("2", "The contractor must complete the work.")
    assert fact.modality == "MUST"

def test_extract_modality_may(extractor):
    fact = extractor.extract("3", "The owner may inspect the premises.")
    assert fact.modality == "MAY"

def test_extract_date(extractor):
    fact = extractor.extract("4", "The contract ends on 31/12/2025.")
    assert "31/12/2025" in fact.dates

def test_extract_parties(extractor):
    fact = extractor.extract("5", "John Doe and Google LLC entered an agreement.")
    assert "John Doe" in fact.parties or "Google LLC" in fact.parties
