FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RUFF_NO_CACHE=true \
    PATH=/opt/venv/bin:$PATH
RUN python -m venv /opt/venv && useradd --uid 1000 --create-home app
WORKDIR /app
COPY pyproject.toml .
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)"

FROM base AS dev
RUN pip install --no-cache-dir ".[dev]"
COPY . .
USER app

FROM base AS prod
RUN pip install --no-cache-dir .
COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
USER app
CMD ["sh", "-c", "alembic upgrade head && exec gunicorn app.main:app -k uvicorn_worker.UvicornWorker -w 2 -b 0.0.0.0:8000"]
