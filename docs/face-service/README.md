# Face Service (Python microservice)

This service provides face encoding and matching for the HRMS **Face Attendance** feature. The backend calls it at `http://localhost:8000` for:

- **POST /generate-encoding** – convert a base64 image to a 128-float face encoding (used when registering an employee’s face).
- **POST /match-face** – match a live base64 image against stored encodings (used for face punch).

---

## Quick start (Docker – recommended)

**Prerequisite:** [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) installed and running. If `docker` is not recognized, install it and restart the terminal.

From the **face-service** folder:

```powershell
cd face-service
docker build -t face-service .
docker run -p 8000:8000 face-service
```

Or from the **project root** (easiest):

```powershell
.\run-face-service.ps1
```

Or with docker compose directly:

```powershell
docker compose up -d face-service
```

- Service runs in a Linux container with full **face_recognition** (no dlib/CMake issues on Windows).
- Backend at `http://localhost:5000` reaches it at `http://localhost:8000`.
- **Verify:** open http://localhost:8000/health → `{"status":"ok"}`.

To run the container in the background: `docker run -d -p 8000:8000 --name face-svc face-service`. Stop with: `docker stop face-svc`.

---

## Other ways to run

### Local Python (when Docker is not available)

**Prerequisites:** Python 3.9+ (3.10 or 3.11 recommended). On Windows, **dlib** often needs Visual C++ build tools or a pre-built wheel.

From the **face-service** folder:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn face_service:app --host 0.0.0.0 --port 8000
```

Use **`python -m uvicorn`** so it works even when `uvicorn` is not on your PATH.

**If `pip install -r requirements.txt` fails (dlib/CMake on Windows):**

- **Core-only (health only):** `pip install -r requirements-core.txt` then run uvicorn. `/health` works; encode/match return “face_recognition not installed”.
- **Conda:** `conda create -n face-service python=3.10 -y`, `conda activate face-service`, `conda install -c conda-forge face_recognition -y`, then `pip install fastapi "uvicorn[standard]" pydantic` and run uvicorn from the face-service folder.
- **Native:** Install [CMake](https://cmake.org/) and [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), then `pip install -r requirements.txt`.

---

## Check it’s running

- **Health:** http://localhost:8000/health → `{"status":"ok"}`.
- **API docs:** http://localhost:8000/docs (FastAPI Swagger UI).

## Backend configuration

The Node backend uses `FACE_SERVICE_URL` (default `http://localhost:8000`). To use another host/port, set in **backend/.env**:

```env
FACE_SERVICE_URL=http://localhost:8000
```

### Port 8000 already in use (WinError 10048)

Another process (often a previous face-service or container) is using port 8000. Either use the already-running service (check http://localhost:8000/health) or free the port: from `face-service` run `.\kill-port-8000.ps1`, then start the service again.

Keep this service running whenever you use **Face Attendance** (encode or punch). If it’s not running, the backend returns **503** with “Face service unreachable”.
