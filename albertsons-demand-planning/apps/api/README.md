# adp-api

FastAPI service for the planner dashboard.

```bash
pip install -e .
ADP_DATA_DIR=../../infra/data uvicorn adp_api.main:app --reload --port 8000
```

OpenAPI: <http://localhost:8000/docs>

The service is **read-mostly**. It loads parquet artifacts produced by the
science pipelines at startup, serves them with light projection and
aggregation, and exposes a tiny write surface for planner overrides.
