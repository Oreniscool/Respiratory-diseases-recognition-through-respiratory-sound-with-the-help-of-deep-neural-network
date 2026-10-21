"""Production WSGI entry point for Gunicorn or another WSGI process manager."""

from server import app, load_model_once

# Load eagerly so /health reports readiness without loading the model on a request.
try:
    load_model_once()
except Exception as error:  # the server stays up and keeps reporting not-ready
    print(f"[RespiNet] WARNING: {error}")

__all__ = ["app"]

