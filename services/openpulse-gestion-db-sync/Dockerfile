FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pip3 install --break-system-packages --no-cache-dir azure-storage-blob
WORKDIR /app
COPY sync_apercu_to_azure.py /app/sync_apercu_to_azure.py
CMD ["python3", "/app/sync_apercu_to_azure.py"]
