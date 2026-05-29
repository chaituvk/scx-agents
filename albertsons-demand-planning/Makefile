.PHONY: help science-install data train forecast replenish api web web-install test fmt clean

help:
	@echo "Targets:"
	@echo "  science-install  install the Python science package (editable)"
	@echo "  data             generate synthetic sales data"
	@echo "  train            train forecasting models"
	@echo "  forecast         produce a forecast horizon"
	@echo "  replenish        produce replenishment recommendations"
	@echo "  api              run FastAPI dev server (port 8000)"
	@echo "  web-install      install Node deps for the planner dashboard"
	@echo "  web              run Next.js dev server (port 3000)"
	@echo "  test             run python tests"
	@echo "  clean            remove generated artifacts"

science-install:
	cd packages/science && pip install -e .
	cd apps/api && pip install -e .

data:
	python -m adp_science.pipelines.generate_data --out infra/data/raw

train:
	python -m adp_science.pipelines.train --sales infra/data/raw/sales.parquet --out infra/data/models

forecast:
	python -m adp_science.pipelines.forecast_batch \
	  --sales infra/data/raw/sales.parquet \
	  --models infra/data/models \
	  --out infra/data/forecasts \
	  --horizon 28

replenish:
	python -m adp_science.pipelines.replenish \
	  --forecasts infra/data/forecasts/horizon.parquet \
	  --skus infra/data/raw/skus.parquet \
	  --out infra/data/recommendations

api:
	cd apps/api && ADP_DATA_DIR=$(PWD)/infra/data uvicorn adp_api.main:app --reload --port 8000

web-install:
	cd apps/web && npm install

web:
	cd apps/web && npm run dev

test:
	cd packages/science && python -m pytest -q

clean:
	rm -rf infra/data/raw infra/data/models infra/data/forecasts infra/data/recommendations
	find . -type d -name __pycache__ -exec rm -rf {} +
