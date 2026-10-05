from services.document_service import DocumentService
from services.preprocessing_service import PreprocessingService
from services.clause_service import ClauseService
from services.extraction_service import ExtractionService
from services.graph_service import GraphService
from services.constraint_service import ConstraintService
from services.verification_service import VerificationService
from services.explanation_service import ExplanationService

text = (
    "The tenant shall pay rent of Rs 10000 per month by the 5th of each month. "
    "The landlord must not enter the premises without 24 hours notice. "
    "The tenant must not sublet or assign the property without prior written consent of the landlord. "
    "If the tenant breaches this agreement, liquidated damages of Rs 50000 shall apply."
)

pre = PreprocessingService()
clean = pre.preprocess(text)
print("Preprocessing:  OK")

cs = ClauseService()
clauses = cs.segment(clean)
print(f"Segmentation:   OK - {len(clauses)} clauses")

ex = ExtractionService()
facts = [ex.extract(c["clause_id"], c["text"]) for c in clauses]
print(f"Extraction:     OK - {len(facts)} facts")

gs = GraphService()
graph = gs.build_graph(facts)
print(f"Graph Build:    OK - {graph.node_count()} nodes, {graph.edge_count()} edges")

con = ConstraintService()
constraints = con.generate_constraints(graph, facts)
print(f"Constraints:    OK - {len(constraints)} constraints")
print(f"  Types: {[c.constraint_type for c in constraints]}")

vs = VerificationService()
g2 = gs.build_graph(facts)
vresult = vs.compare_graphs(graph, facts[0], g2, facts[0])
print(f"Verification:   OK - status={vresult['status']} score={vresult['score']}")

exp = ExplanationService()
glossary = exp.generate_glossary([clean])
print(f"Glossary:       OK - {len(glossary)} terms: {[g['term'] for g in glossary]}")

print()
print("ALL PIPELINE STEPS PASSED - Backend ready!")
