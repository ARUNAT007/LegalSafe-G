import pytest
from services.verification_service import VerificationService
from models.legal_fact import LegalFact
from models.legal_graph import LegalGraph

def test_verification_pass():
    svc = VerificationService()
    of = LegalFact(amount="$100", modality="MUST")
    sf = LegalFact(amount="$100", modality="MUST")
    og = LegalGraph()
    sg = LegalGraph()
    res = svc.compare_graphs(og, of, sg, sf)
    assert res['status'] == "PASS"
    assert res['score'] == 1.0

def test_verification_fail_amount():
    svc = VerificationService()
    of = LegalFact(amount="$100")
    sf = LegalFact(amount="$50")
    res = svc.compare_graphs(LegalGraph(), of, LegalGraph(), sf)
    assert res['status'] == "FAIL"

def test_verification_fail_modality():
    svc = VerificationService()
    of = LegalFact(modality="MUST")
    sf = LegalFact(modality="MAY")
    res = svc.compare_graphs(LegalGraph(), of, LegalGraph(), sf)
    assert res['status'] == "FAIL"

def test_verification_fail_party():
    svc = VerificationService()
    of = LegalFact(parties=["Tenant"])
    sf = LegalFact(parties=["Owner"])
    res = svc.compare_graphs(LegalGraph(), of, LegalGraph(), sf)
    assert res['status'] == "FAIL"

def test_verification_partial_score():
    svc = VerificationService()
    of = LegalFact(amount="$100", modality="MUST")
    sf = LegalFact(amount="$100", modality="MAY") # One pass, one fail
    res = svc.compare_graphs(LegalGraph(), of, LegalGraph(), sf)
    assert res['status'] == "FAIL"
    assert res['score'] == 0.5
