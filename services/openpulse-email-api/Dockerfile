# syntax=docker/dockerfile:1
FROM python:3.13-slim

WORKDIR /srv/app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
# Probe santé Container Apps: GET /healthz
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
