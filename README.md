# LegalSafe-G ⚖️
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
