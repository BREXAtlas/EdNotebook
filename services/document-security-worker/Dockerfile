FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/tmp/ednotebook-home \
    PORT=8080

RUN apt-get update && apt-get install -y --no-install-recommends \
    clamav \
    clamav-freshclam \
    file \
    fonts-dejavu-core \
    gosu \
    libmagic1 \
    libreoffice-core \
    libreoffice-impress \
    libreoffice-writer \
    poppler-utils \
    tini \
    unzip \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/lib/clamav /tmp/ednotebook-home /app \
    && chown -R nobody:nogroup /tmp/ednotebook-home /app

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY entrypoint.sh ./entrypoint.sh
RUN chmod 0755 ./entrypoint.sh && chown -R nobody:nogroup /app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=3)" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
