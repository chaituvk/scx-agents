FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install the science package first so its layer caches.
COPY packages/science /app/packages/science
RUN pip install --no-cache-dir -e /app/packages/science

COPY apps/api /app/apps/api
RUN pip install --no-cache-dir -e /app/apps/api

ENV ADP_DATA_DIR=/data
EXPOSE 8000

CMD ["uvicorn", "adp_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
