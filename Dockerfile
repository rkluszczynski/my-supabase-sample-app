# syntax=docker/dockerfile:1

FROM --platform=linux/amd64 node:22-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM --platform=linux/amd64 python:3.11-alpine AS backend-build
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/pyproject.toml ./
COPY backend/src ./src
RUN pip install --no-cache-dir --prefix=/install .


FROM --platform=linux/amd64 python:3.11-alpine AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/usr/local/bin:${PATH}"

COPY --from=backend-build /install /usr/local
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=backend-build /app/backend ./backend
COPY backend/run_ingest.sh ./backend/run_ingest.sh
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY frontend_server.py ./frontend_server.py

RUN chmod +x /app/docker-entrypoint.sh /app/backend/run_ingest.sh

EXPOSE 4173

ENTRYPOINT ["/app/docker-entrypoint.sh"]
