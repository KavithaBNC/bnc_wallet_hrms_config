# Deployment Checklist

## Pre-deployment

### 1. Environment variables

**Backend** (`backend/.env`):
- `DATABASE_URL` - Production PostgreSQL connection string
- `JWT_SECRET` - Strong random string (32+ chars)
- `JWT_REFRESH_SECRET` - Different strong random string
- `NODE_ENV=production`
- `PORT` - Backend port (e.g. 5001)
- `BASE_URL` - Full backend URL (e.g. `https://api.yourdomain.com`)
- `CORS_ORIGIN` - Frontend URL (e.g. `https://app.yourdomain.com`)
- `CONFIGURATOR_API_URL` - Configurator API base (e.g. `https://configurator.yourdomain.com`)
- `CONFIGURATOR_DEFAULT_COMPANY_ID` - Default company ID

**Frontend** (build-time env):
- `VITE_API_BASE_URL` - Full API URL (e.g. `https://api.yourdomain.com/api/v1`)

### 2. Database

- Run migrations: `cd backend && npx prisma migrate deploy`
- Run org sync if needed: `scripts/sync-organization-configurator-59.sql`
- Verify `organizations.configurator_company_id` is set for your company

### 3. Build

```bash
npm run build
```

- Backend: `backend/dist/`
- Frontend: `frontend/dist/`

### 4. Run

**Backend** (Node/PM2):
```bash
cd backend && node dist/server.js
```

**Frontend**: Serve `frontend/dist/` via nginx/Apache/static host.

### 5. Reverse proxy (recommended)

- Route `/api` to backend (e.g. `http://localhost:5001`)
- Serve frontend static files for `/`
- Single domain avoids CORS; set `VITE_API_BASE_URL` to same origin `/api/v1`

## Folder structure

```
bnc_wallet_hrms_config/
├── backend/           # Node/Express API
│   ├── prisma/        # Schema, migrations
│   ├── src/
│   │   ├── config/    # config.ts, constants.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   └── ...
│   └── .env           # Not in git
├── frontend/          # React/Vite SPA
│   ├── src/
│   │   ├── config/    # env.ts
│   │   └── ...
│   └── .env           # Not in git
├── scripts/           # SQL, seed scripts
├── docs/
└── package.json       # Root scripts
```

## URL single source

| Context | Source | Example |
|---------|--------|---------|
| Backend base | `BASE_URL` env | `https://api.example.com` |
| Backend API | `config.baseUrl + /api/v1` | `https://api.example.com/api/v1` |
| Frontend API (dev) | `/api/v1` (Vite proxy) | - |
| Frontend API (prod) | `VITE_API_BASE_URL` | `https://api.example.com/api/v1` |
| Configurator | `CONFIGURATOR_API_URL` | `https://config.example.com` |
