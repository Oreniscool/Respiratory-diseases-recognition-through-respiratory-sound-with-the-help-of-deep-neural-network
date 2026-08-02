# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Final Multi-service Container (Python Backend + Nginx Frontend)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    RESPINET_HOST=0.0.0.0 \
    RESPINET_PORT=5000

# Install audio dependencies, Nginx, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install backend requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application source code
COPY backend/ ./backend/

# Copy frontend static build assets to Nginx html directory
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

# Clean default site configs and install robust Nginx configuration
RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default /etc/nginx/conf.d/default.conf

RUN echo 'server { \
    listen 80 default_server; \
    listen [::]:80 default_server; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { proxy_pass http://127.0.0.1:5000/health; } \
    location /predict { proxy_pass http://127.0.0.1:5000/predict; client_max_body_size 25M; } \
    location /predict-sample/ { proxy_pass http://127.0.0.1:5000/predict-sample/; } \
    location /explain { proxy_pass http://127.0.0.1:5000/explain; client_max_body_size 25M; } \
    location /summarize { proxy_pass http://127.0.0.1:5000/summarize; } \
}' > /etc/nginx/conf.d/default.conf && \
ln -sf /etc/nginx/conf.d/default.conf /etc/nginx/sites-enabled/default 2>/dev/null || true

# Startup script to verify and start Nginx then launch Flask backend
RUN echo '#!/bin/sh\n\
nginx -t\n\
service nginx start\n\
cd /app/backend\n\
exec python server.py\n' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 80 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["/app/start.sh"]
