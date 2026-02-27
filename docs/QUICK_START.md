# Quick Start Guide - HRMS Portal 2026

This guide will help you get the HRMS Portal running locally in minutes.

## Prerequisites Checklist

- [ ] Node.js 20+ installed ([Download](https://nodejs.org/))
- [ ] Docker Desktop installed ([Download](https://www.docker.com/))
- [ ] Git installed

## 🚀 Quick Setup (5 minutes)

### Step 1: Start Database Services

```bash
# Start PostgreSQL, Redis, and pgAdmin
docker-compose up -d

# Verify services are running
docker-compose ps
```

You should see:
- ✅ hrms_postgres (PostgreSQL on port 5432)
- ✅ hrms_redis (Redis on port 6379)
- ✅ hrms_pgadmin (pgAdmin on port 5050)

### Step 2: Setup Backend

```bash
cd backend

# Install dependencies (first time only)
npm install

# Setup environment
cp .env.example .env

# Generate Prisma Client
npm run prisma:generate

# Create database tables
npm run prisma:migrate

# Start development server
npm run dev
```

✅ Backend running at: http://localhost:5000

Test it: http://localhost:5000/health

### Step 3: Setup Frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Setup environment
cp .env.example .env

# Start development server
npm run dev
```

✅ Frontend running at: http://localhost:3000

## 🎉 You're Ready!

Open your browser:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api/v1
- **pgAdmin**: http://localhost:5050 (admin@hrms.com / admin)

## 📋 Verification Checklist

Test these URLs to verify everything is working:

- [ ] http://localhost:3000 - Homepage
- [ ] http://localhost:3000/login - Login page
- [ ] http://localhost:3000/dashboard - Dashboard
- [ ] http://localhost:5000/health - Backend health check
- [ ] http://localhost:5000/api/v1 - API info
- [ ] http://localhost:5050 - pgAdmin

## 🛠️ Useful Commands

### Backend

```bash
# Development
npm run dev                 # Start dev server with hot reload
npm run build               # Build for production
npm start                   # Start production server

# Database
npm run prisma:studio       # Open Prisma Studio (DB GUI)
npm run prisma:migrate      # Run migrations
npm run prisma:generate     # Generate Prisma Client

# Code Quality
npm run lint                # Check code with ESLint
npm run format              # Format code with Prettier
npm test                    # Run tests
```

### Frontend

```bash
# Development
npm run dev                 # Start dev server
npm run build               # Build for production
npm run preview             # Preview production build

# Code Quality
npm run lint                # Check code with ESLint
npm run format              # Format code with Prettier
```

### Docker

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart postgres

# Remove volumes (⚠️ deletes all data)
docker-compose down -v
```

## 🔧 Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Check what's using the port
lsof -i :5000  # Backend
lsof -i :3000  # Frontend
lsof -i :5432  # PostgreSQL

# Kill the process or change ports in .env files
```

### Database Connection Failed

```bash
# Make sure PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check the DATABASE_URL in backend/.env
```

### npm install fails

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and try again
rm -rf node_modules package-lock.json
npm install
```

## 📚 Next Steps

Now that your environment is set up, you can:

1. **Explore the codebase**
   - Check out `backend/src/server.ts` for API structure
   - Look at `frontend/src/pages/` for UI pages
   - Review `backend/prisma/schema.prisma` for database models

2. **Read the documentation**
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
   - [DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql) - Database design
   - [ROADMAP.md](./ROADMAP.md) - Development plan

3. **Start development**
   - Phase 1 is Authentication & User Management
   - Create new branches for features
   - Follow the development roadmap

## 💡 Tips

- **Hot Reload**: Both frontend and backend auto-reload on file changes
- **Prisma Studio**: Run `npm run prisma:studio` for a visual database editor
- **API Testing**: Use Postman or Thunder Client to test API endpoints
- **Database Management**: Access pgAdmin at http://localhost:5050

## 🐛 Getting Help

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify all services are running: `docker-compose ps`
3. Check environment variables in `.env` files
4. Review the main [README.md](./README.md)

---

**Happy Coding! 🚀**

Phase 0 Complete ✅ | Ready for Phase 1: Authentication & User Management
