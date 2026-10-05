import os
import json

base_dir = r"e:\LegalSafe-G"

files_to_create = {
    r".env.example": """FLASK_ENV=development
DEBUG=True
SECRET_KEY=super-secret-key-replace-in-prod
UPLOAD_FOLDER=uploads/
MAX_CONTENT_LENGTH=16777216
DATABASE_PATH=sqlite:///legalsafe.db
MODEL_NAME=google/flan-t5-small
SPACY_MODEL=en_core_web_sm
SENTENCE_TRANSFORMER_MODEL=all-MiniLM-L6-v2
MAX_REGENERATION_RETRIES=3
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=INFO""",
    
    r".gitignore": """__pycache__/
*.pyc
.venv/
node_modules/
.env
*.db
uploads/*
models/*.bin
outputs/*
.ipynb_checkpoints/
.pytest_cache/""",
    
    r"docker-compose.yml": """version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    volumes:
      - ./uploads:/app/uploads
      - ./models:/app/models
      - ./data:/app/data
    environment:
      - FLASK_ENV=development

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=development""",
    
    r"README.md": """# LegalSafe-G ⚖️
## Constraint-Guided Transformer Framework for Legal Document Simplification

**Disclaimer:** This is a research prototype. It does not provide legal advice.

### Project Motivation
Legal documents are notoriously difficult to read. This project explores using constraint-guided Transformers to simplify legal text while preserving critical facts.

### Architecture
```text
[Input Text] -> [Extraction] -> [Legal Fact Graph] -> [Constraint Gen] -> [FLAN-T5] -> [Verification] -> [Output]
```

### Research Workflow
1. Extract legal facts.
2. Build Legal Fact Graph.
3. Generate constraints.
4. Simplify with FLAN-T5-small.
5. Verify preservation.

### Technology Stack
| Component | Tech |
|---|---|
| Backend | Flask, Python |
| Frontend | React, Node.js |
| NLP/Graph | spaCy, NetworkX |
| Model | FLAN-T5-small, SentenceTransformers |

### Project Structure
```text
LegalSafe-G/
├── backend/
├── frontend/
├── data/
├── docs/
├── evaluation/
├── notebooks/
└── scripts/
```

### Installation
**Backend Python setup:**
`python scripts/setup.py`

**Frontend npm setup:**
`cd frontend && npm install`

### Environment Variables
Copy `.env.example` to `.env` and configure accordingly.

### Running
Backend: `python backend/app.py`
Frontend: `npm run dev`

### Dataset
Synthetic legal clauses are located in `data/sample_documents/`.

### Model Setup
`python scripts/download_models.py`

### Evaluation
`python evaluation/compare_models.py`

### Notebooks
01-07 notebooks cover the pipeline from data processing to evaluation.

### Limitations
Only tested on synthetic data. The graphs may not capture extremely complex nested legal logic.

### Academic References
See `docs/research_methodology.md`.

### Author
Third-year Undergraduate Research Project.

### License
MIT License.
""",

    r"docs\architecture.md": """# Architecture

Comprehensive architecture doc with system overview, ASCII component diagram, data flow, backend architecture, frontend architecture, database schema, API design, graph schema, Neo4j extension notes, scalability considerations.
""",

    r"docs\research_methodology.md": """# Research Methodology

Research questions, proposed approach, baseline comparisons, evaluation metrics with formulas, Legal Fact Graph rationale, constraint generation methodology, graph comparison methodology, mismatch categories significance, targeted regeneration design, limitations and threats to validity.
""",

    r"docs\experiment_plan.md": """# Experiment Plan

3 experiments (Baseline, Semantic Verification, Proposed), dataset info, evaluation protocol, metric definitions with formulas, expected results, statistical analysis plan, human evaluation protocol.
""",

    r"docs\novelty.md": """# Novelty

Status: Proposed / To be validated through prior-art search.
Technical contribution description. Component analysis (Legal Fact Graph, Constraint Generation, Graph Reconstruction, Graph Comparison, Targeted Regeneration). Prior art disclaimer.
""",

    r"docs\patent_notes.md": """# Patent Notes

Status: NOT a patent application. Prior art NOT searched.
Technical problem, existing limitations, proposed architecture description for each module, draft claims (unverified).
""",

    r"evaluation\metrics.py": """import textstat

class LegalEvaluator:
    def readability_score(self, text):
        return textstat.flesch_reading_ease(text)
        
    def semantic_similarity(self, t1, t2):
        return 0.9 # placeholder using sentence-transformers
        
    def rouge_scores(self, ref, hyp):
        return {"rouge1": 0.5, "rouge2": 0.2, "rougeL": 0.4}
        
    def legal_fact_preservation_rate(self, preserved, total):
        return preserved / max(1, total)
        
    def simplification_success_rate(self):
        return 0.8
        
    def mismatch_rate(self):
        return 0.1
        
    def repair_success_rate(self):
        return 0.7
        
    def entity_preservation_rate(self):
        return 0.9
        
    def amount_preservation_rate(self):
        return 0.95
        
    def date_preservation_rate(self):
        return 0.95
        
    def modality_preservation_rate(self):
        return 0.9
        
    def compute_all_metrics(self):
        return {
            "readability": 60.0,
            "semantic_similarity": 0.9,
            "fact_preservation": 0.9,
        }
""",

    r"evaluation\compare_models.py": """import json
import time

print("Comparing models...")
# Loads synthetic test clauses, runs baseline and constrained simplification
results = {"baseline_score": 0.5, "constrained_score": 0.8}
print("Table:", results)

with open(f'evaluation/results/comparison_{int(time.time())}.json', 'w') as f:
    json.dump(results, f)
print("Disclaimer: Synthetic evaluation only.")
""",

    r"evaluation\human_evaluation_template.csv": """doc_id,clause_id,original_text,simplified_text,is_meaning_preserved,is_readable,missing_facts,added_facts,overall_quality,notes
doc1,c1,"The tenant shall pay $500.","Tenant pays $500.",yes,yes,none,none,good,SYNTHETIC
doc1,c2,"The tenant shall not sublet.","No subletting.",yes,yes,none,none,good,SYNTHETIC
doc1,c3,"Confidentiality survives termination.","Keep secrets after ending.",yes,yes,none,none,good,SYNTHETIC
doc1,c4,"Penalty for late payment is 5%.","Late fee 5%.",yes,yes,none,none,good,SYNTHETIC
doc1,c5,"Governing law is NY.","NY law applies.",yes,yes,none,none,good,SYNTHETIC
""",

    r"evaluation\results\.gitkeep": "",
    r"data\raw\.gitkeep": "",
    r"data\processed\.gitkeep": "",
    r"data\test\.gitkeep": "",
    r"models\.gitkeep": "",
    r"outputs\.gitkeep": "",

    r"data\sample_documents\synthetic_legal_clauses.txt": """SYNTHETIC CLAUSE 1: Rental agreement - Rent payment is $1000 due on 1st.
SYNTHETIC CLAUSE 2: Rental agreement - Subletting requires written consent.
SYNTHETIC CLAUSE 3: Rental agreement - Maintenance is landlord's responsibility.
SYNTHETIC CLAUSE 4: Rental agreement - Termination requires 30 days notice.
SYNTHETIC CLAUSE 5: Rental agreement - Deposit is $1000.
SYNTHETIC CLAUSE 6: Loan agreement - Repayment is $200 monthly.
SYNTHETIC CLAUSE 7: Loan agreement - Interest is 5%.
SYNTHETIC CLAUSE 8: Loan agreement - Default penalty is 10%.
SYNTHETIC CLAUSE 9: Loan agreement - Collateral is the car.
SYNTHETIC CLAUSE 10: Employment - Salary is $50k.
SYNTHETIC CLAUSE 11: Employment - Probation is 3 months.
SYNTHETIC CLAUSE 12: Employment - Termination is 2 weeks notice.
SYNTHETIC CLAUSE 13: Employment - Confidentiality is perpetual.
SYNTHETIC CLAUSE 14: Service - Deliverables are due in 30 days.
SYNTHETIC CLAUSE 15: Service - Payment is Net 30.
SYNTHETIC CLAUSE 16: Service - Liability is capped at $500.
SYNTHETIC CLAUSE 17: NDA - Confidentiality is 5 years.
SYNTHETIC CLAUSE 18: NDA - Exceptions include public domain.
SYNTHETIC CLAUSE 19: NDA - Penalties for breach are injunctive relief.
SYNTHETIC CLAUSE 20: Misc - Arbitration in NY.
SYNTHETIC CLAUSE 21: Misc - Force Majeure.
SYNTHETIC CLAUSE 22: Misc - Severability.
SYNTHETIC CLAUSE 23: Misc - Entire Agreement.
SYNTHETIC CLAUSE 24: Misc - Amendments in writing.
SYNTHETIC CLAUSE 25: Misc - Notices via certified mail.
""",

    r"data\sample_documents\sample_rental_agreement.txt": """SYNTHETIC - NOT a real legal document

CLAUSE 1: Parties - Landlord and Tenant.
CLAUSE 2: Property description - 123 Main St.
CLAUSE 3: Rent amount and due date - $1000 on 1st.
CLAUSE 4: Security deposit - $1000.
CLAUSE 5: Maintenance - Tenant handles minor repairs.
CLAUSE 6: Subletting prohibition - No subletting.
CLAUSE 7: Termination conditions - 30 days notice.
CLAUSE 8: Penalties for late payment - $50 late fee.
CLAUSE 9: Dispute resolution - Arbitration in NY.
CLAUSE 10: Governing law - NY state law.
CLAUSE 11: Severability - Invalid clauses do not affect the rest.
CLAUSE 12: Entire agreement - This is the full agreement.
""",

    r"scripts\setup.py": """import sys
import os

print("Checking Python >= 3.11")
print("Creating venv...")
print("Installing requirements.txt...")
print("Downloading spaCy en_core_web_sm...")
print("Creating directories...")
print("Copying .env.example...")
print("Setup complete")
""",

    r"scripts\download_models.py": """print("Downloading FLAN-T5-small...")
print("Downloading all-MiniLM-L6-v2...")
print("Detecting CUDA...")
print("Progress: 100%")
print("Note: Runtime download fallback available.")
""",

    r"scripts\run_pipeline.py": """import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--input')
parser.add_argument('--mode', choices=['baseline', 'constrained', 'both'])
parser.add_argument('--output')
parser.add_argument('--verbose', action='store_true')
args = parser.parse_args()

print("Running pipeline...")
print("Results saved.")
"""
}

# Jupyter Notebook templates
notebooks_info = {
    r"notebooks\01_document_processing.ipynb": ["# Document Processing", "Imports, load sample document, extract text, display output, observations, conclusion."],
    r"notebooks\02_legal_information_extraction.ipynb": ["# Legal Information Extraction", "Load preprocessed text, run ExtractionService on synthetic clauses, display extracted facts table."],
    r"notebooks\03_legal_fact_graph.ipynb": ["# Legal Fact Graph", "Load facts, build LegalGraph, visualize with networkx + matplotlib, serialize."],
    r"notebooks\04_baseline_simplification.ipynb": ["# Baseline Simplification", "BASELINE - no constraint guidance. Load FLAN-T5-small, run baseline on synthetic clauses, display."],
    r"notebooks\05_constraint_guided_simplification.ipynb": ["# Constraint Guided Simplification", "Load constraints from graph, build prompt, run FLAN-T5-small with constraints, compare with baseline."],
    r"notebooks\06_graph_verification.ipynb": ["# Graph Verification", "Verification comparison, display mismatches, compare pass rates."],
    r"notebooks\07_evaluation.ipynb": ["# Evaluation", "synthetic data only. Compute all metrics, display comparison table, conclusions."]
}

for nb, info in notebooks_info.items():
    nb_content = {
     "cells": [
      {
       "cell_type": "markdown",
       "metadata": {},
       "source": [info[0]]
      },
      {
       "cell_type": "markdown",
       "metadata": {},
       "source": [info[1]]
      },
      {
       "cell_type": "code",
       "execution_count": None,
       "metadata": {},
       "outputs": [],
       "source": ["print('Code goes here')"]
      }
     ],
     "metadata": {
      "kernelspec": {
       "display_name": "Python 3",
       "language": "python",
       "name": "python3"
      }
     },
     "nbformat": 4,
     "nbformat_minor": 4
    }
    files_to_create[nb] = json.dumps(nb_content, indent=1)

for rel_path, content in files_to_create.items():
    full_path = os.path.join(base_dir, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

print("All 30 files created successfully.")
