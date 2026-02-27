# Face service with full face_recognition (dlib). Use this when local pip install fails on Windows.
FROM python:3.11-slim

WORKDIR /app

# System deps for dlib/face_recognition (cmake, compiler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    libopenblas-dev \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY face_service.py .

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "face_service:app", "--host", "0.0.0.0", "--port", "8000"]
