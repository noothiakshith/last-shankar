FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create volume dir for models
RUN mkdir -p /tmp/artifacts

COPY main.py .

EXPOSE 8000
ENV ARTIFACT_DIR=/tmp/artifacts

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
