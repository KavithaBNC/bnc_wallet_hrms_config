# HRMS Portal 2026

A comprehensive Human Resource Management System built with modern technologies, featuring Core HR, Payroll, AI-powered Applicant Tracking System (ATS), and an AI Chatbot for employee self-service.

## 🚀 Features 




- **Core HR Management**: Employee profiles, departments, organizational hierarchy
- **Attendance & Leave Management**: Track attendance, manage leave requests
- **Payroll Processing**: Automated payroll with multi-jurisdiction tax compliance
- **AI-Powered ATS**: Resume parsing and intelligent candidate ranking
- **AI Chatbot**: Employee self-service for common HR queries
- **Performance Management**: 360-degree feedback, goal tracking (OKRs)
- **Document Management**: Centralized repository with digital signatures
- **Reports & Analytics**: Interactive dashboards and custom reports

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand + React Query (TanStack Query)
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form + Zod
- **Routing**: React Router v6
- **Charts**: Recharts

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **ORM**: Prisma
- **Authentication**: JWT + Passport.js
- **Validation**: Zod
- **Logging**: Winston
- **API Documentation**: Swagger/OpenAPI

### Database & Caching
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Search**: PostgreSQL Full-Text Search
- **Vector DB**: pgvector (for AI embeddings)

### AI/ML
- **LLM**: OpenAI GPT-4 API
- **Embeddings**: OpenAI Embeddings for semantic search
- **Resume Parsing**: Custom NLP + OpenAI
- **Candidate Ranking**: AI-powered matching algorithm

### DevOps
- **Containerization**: Docker + Docker Compose
- **Version Control**: Git

## 📁 Project Structure

```
hrms_2026/
├── backend/                 # Backend API (Node.js + Express)
│   ├── prisma/             # Prisma schema and migrations
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middlewares/    # Express middlewares
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── server.ts       # Express server entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/               # Frontend App (React + TypeScript)
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   ├── store/          # State management
│   │   ├── types/          # TypeScript types
│   │   ├── utils/          # Utility functions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── database/               # Database scripts
│   └── init.sql
│
├── docker/                 # Docker configurations
├── docker-compose.yml      # Docker Compose for local development
├── ARCHITECTURE.md         # System architecture documentation
├── DATABASE_SCHEMA.sql     # Complete database schema
├── ROADMAP.md             # Development roadmap
└── README.md              # This file
```

## 🏁 Getting Started

### Prerequisites

- Node.js 20+ ([Download](https://nodejs.org/))
- Docker & Docker Compose ([Download](https://www.docker.com/))
- Git

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd hrms_2026
```

2. **Start the database services with Docker**

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- pgAdmin (port 5050) - Access at http://localhost:5050

3. **Setup Backend**

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env and update values if needed

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

Backend API will be running at http://localhost:5000

4. **Setup Frontend**

```bash
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

Frontend app will be running at http://localhost:3000

### Environment Variables

#### Backend (.env)

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/hrms_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
OPENAI_API_KEY=your-openai-api-key
```

#### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

## 🔑 API Endpoints

### Health Check
```
GET /health
```

### API v1
```
GET /api/v1
```

## 📚 Documentation

- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete system architecture
- **Database Schema**: See [DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql) for database design
- **Development Roadmap**: See [ROADMAP.md](./ROADMAP.md) for development phases

## 🗺️ Development Roadmap

- ✅ **Phase 0**: Foundation & Setup (Current)
- ⏳ **Phase 1**: Authentication & User Management (2 weeks)
- ⏳ **Phase 2**: Core HR - Employee Management (3 weeks)
- ⏳ **Phase 3**: Attendance & Leave Management (3 weeks)
- ⏳ **Phase 4**: Payroll Management (4 weeks)
- ⏳ **Phase 5**: ATS with AI (4 weeks)
- ⏳ **Phase 6**: AI Chatbot (3 weeks)
- ⏳ **Phase 7**: Performance Management (2 weeks)
- ⏳ **Phase 8**: Document Management & Onboarding (2 weeks)
- ⏳ **Phase 9**: Reports & Analytics (2 weeks)
- ⏳ **Phase 10**: Testing & Deployment (3 weeks)

**Total Timeline**: ~30 weeks (7 months)

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
npm run test:watch
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📦 Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## 🛠️ Development Tools

### Database Management
- **pgAdmin**: http://localhost:5050
  - Email: admin@hrms.com
  - Password: admin

### Prisma Studio
```bash
cd backend
npm run prisma:studio
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Code Style

- **Backend**: ESLint + Prettier (run `npm run lint` and `npm run format`)
- **Frontend**: ESLint + Prettier (run `npm run lint` and `npm run format`)

## 🔐 Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Input validation with Zod
- SQL injection prevention (Prisma ORM)
- XSS protection (Helmet middleware)
- Rate limiting

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

HRMS Portal 2026 - Built with ❤️ using modern web technologies

## 📞 Support

For issues and feature requests, please create an issue in the repository.

---

**Status**: Phase 0 - Foundation Complete ✅

**Last Updated**: January 23, 2026
