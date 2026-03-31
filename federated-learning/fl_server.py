"""
DEPRECATED: This file is kept for reference only.

The Flower-based gRPC FL server has been replaced with a standalone
REST API service located at:

    ../fl-server/app.py

The new server:
  - Is independently deployable (Docker/AWS/Azure)
  - Uses REST endpoints instead of gRPC
  - Implements round-based time-window aggregation (not fixed rounds)
  - Supports async client updates
  - Serves inference for web users

To run the new FL server:
    cd ../fl-server
    pip install -r requirements.txt
    python app.py

Or with Docker:
    docker build -t fl-server .
    docker run -p 6000:6000 fl-server
"""

raise SystemExit(
    "This file is deprecated. Use '../fl-server/app.py' instead."
)
