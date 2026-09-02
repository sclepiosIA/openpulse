# syntax=docker/dockerfile:1
FROM python:3.13-slim@sha256:6771159cd4fa5d9bba1258caf0b82e6b73458c694d178ad97c5e925c2d0e1a91

WORKDIR /srv/app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts

EXPOSE 8000
# Chaque nouvelle révision applique d'abord les migrations idempotentes ;
# l'API ne devient prête que si PostgreSQL et le schéma sont disponibles.
CMD ["sh", "-c", "python scripts/migrate.py && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
