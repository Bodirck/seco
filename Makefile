PYTHON ?= python

.PHONY: install data run eval test fmt clean

install:
	$(PYTHON) -m pip install -r requirements.txt
	$(PYTHON) -m pip install -e .

# Download or generate the public data and populate the database.
data:
	$(PYTHON) -m buildinglens.pipeline

# Launch the Streamlit app.
run:
	streamlit run app/streamlit_app.py

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
