FROM python:3.11-slim

WORKDIR /app

# Install system deps for torch/timm
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Persistent data volumes
VOLUME ["/app/models/global", "/app/client_updates"]

ENV FL_SERVER_PORT=6000 \
    ROUND_DURATION_SECONDS=86400 \
    MODELS_DIR=/app/models/global \
    CLIENT_UPDATES_DIR=/app/client_updates

EXPOSE 6000

# Use gunicorn in production
CMD ["gunicorn", "--bind", "0.0.0.0:6000", "--workers", "2", "--timeout", "120", "app:app"]
