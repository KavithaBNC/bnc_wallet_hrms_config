# HRMS Project - Tech Stack

## Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.2 | UI Framework |
| **Vite** | 5 | Build tool |
| **TypeScript** | - | Type safety |
| **Tailwind CSS** | 3.4 | Styling |
| **React Router** | 6.21 | Client-side routing |
| **TanStack Query** | 5.17 | Server state management |
| **Zustand** | 4.4.7 | Client state management |
| **React Hook Form + Zod** | - | Forms & validation |
| **Axios** | 1.6.5 | HTTP client |
| **Recharts** | 2.10 | Charts & graphs |
| **react-webcam** | 7.2 | Webcam (face attendance) |
| **xlsx** | 0.18.5 | Excel export |
| **react-datepicker** | 9.1 | Date pickers |
| **date-fns** | 3.6 | Date utilities |

## Backend

| Technology | Version | Purpose |
|---|---|---|
| **Node.js + Express** | 4.18.2 | REST API server |
| **TypeScript** | 5.3.3 | Type safety |
| **Prisma** | 5.8 | ORM |
| **JWT (jsonwebtoken)** | 9.0.2 | Authentication |
| **bcryptjs** | 2.4.3 | Password hashing |
| **Redis** | 4.6.12 | Caching & sessions |
| **Nodemailer** | 6.9.7 | Email sending |
| **PDFKit** | 0.17.2 | PDF generation |
| **Winston** | 3.11 | Logging |
| **Helmet + CORS** | - | Security middleware |
| **Compression + Morgan** | - | HTTP utilities |
| **Joi + Zod** | - | Request validation |

## Face Service (Microservice)

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.x | Language |
| **FastAPI** | - | API framework |
| **Uvicorn** | - | ASGI server |
| **face_recognition** | 1.3.0 | Face detection & matching |
| **NumPy** | - | Numerical processing |
| **Pydantic** | v2 | Data validation |

## Database & Infrastructure

| Technology | Purpose |
|---|---|
| **PostgreSQL** | Primary database |
| **AWS RDS** | Managed PostgreSQL hosting (ap-south-1 / Mumbai) |
| **Redis** | Cache & session store |
| **Docker Compose** | Local development infrastructure |
| **pgAdmin** | Database GUI tool (local dev) |

## Ports (Local Development)

| Service | Port |
|---|---|
| Frontend (Vite) | 3000 |
| Backend (Express) | 5000 |
| Face Service (FastAPI) | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| pgAdmin | 5050 |

## Architecture Overview

```
Frontend  →  React + Vite + Tailwind CSS       (Port 3000)
Backend   →  Express + TypeScript + Prisma     (Port 5000)
Face API  →  Python FastAPI + face_recognition (Port 8000)
Database  →  PostgreSQL on AWS RDS
Cache     →  Redis
```

## API Structure

All backend REST API routes are versioned under `/api/v1/`:

- `/auth` - Authentication (login, refresh token)
- `/organizations` - Organization management
- `/departments` - Department management
- `/positions` - Position/designation management
- `/employees` - Employee management
- `/attendance` - Attendance tracking
- `/leaves` - Leave management
- `/payroll` - Payroll processing
- `/shifts` - Shift management
- `/face` - Face recognition
- `/holidays` - Holiday calendar
- `/recruitment` - ATS (Applicant Tracking System)
- `/approval-workflows` - Approval flow management
