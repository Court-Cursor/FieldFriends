FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir .
RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["/app/start.sh"]
