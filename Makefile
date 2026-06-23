PYTHON ?= python

.PHONY: install data extract eval web run test fmt clean

install:
	$(PYTHON) -m pip install -r requirements.txt
	$(PYTHON) -m pip install -e .

# Download or generate the public data and populate the database.
data:
	$(PYTHON) -m buildinglens.pipeline

# Extract defects with the LLM, score buildings, and build the RAG index.
# Needs an API key in .env for real defects (mock mode inserts none).
extract:
	$(PYTHON) -m buildinglens.build_ai

# Primary UI: launch the FastAPI backend and the React (Vite) dev server together.
# Open http://localhost:5173. Needs `npm install` in web/ the first time.
web:
	$(PYTHON) scripts/dev.py

# Backup UI: launch the Streamlit app. Invoke via `python -m streamlit` so it works
# even when the streamlit launcher script is not on PATH (common on Windows).
run:
	$(PYTHON) -m streamlit run app/streamlit_app.py

# Evaluate the extraction against the reference (gold) set.
eval:
	$(PYTHON) -m eval.eval_extraction

test:
	$(PYTHON) -m pytest -q

fmt:
	$(PYTHON) -m ruff format . || true

# Remove the generated database (keeps downloaded raw sources).
clean:
	$(PYTHON) -c "import os; p='data/buildinglens.db'; os.path.exists(p) and os.remove(p)"
