# 🚀 NexisERP Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- Docker and Docker Compose installed
- npm or yarn package manager

## First Time Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
Copy the example environment file:
```bash
cp .env.example .env.local
```

### 3. Start Everything
```bash
npm run setup
```

This command will:
- ✅ Start PostgreSQL database (port 5432)
- ✅ Start Python ML service (port 8000)
- ✅ Run database migrations
- ✅ Seed initial data

### 4. Start Development Server
In a **new terminal window**:
```bash
npm run dev
```

Visit: **http://localhost:3000**

---

## Daily Development

### Start the Application
```bash
npm run start:all
```

This starts Docker services and waits, then you can run `npm run dev` in another terminal.

Or manually:
```bash
# Terminal 1: Start Docker services
npm run docker:up

# Terminal 2: Start Next.js
npm run dev
```

### Stop the Application
```bash
npm run docker:down
```

---

## Available NPM Scripts

### Development
- `npm run dev` - Start Next.js development server
- `npm run start:all` - Start Docker + dev server
- `npm run build` - Build for production
- `npm run start` - Start production server (requires build first)

### Docker Management
- `npm run docker:up` - Start database and ML service
- `npm run docker:down` - Stop all Docker services
- `npm run docker:logs` - View Docker logs
- `npm run docker:rebuild` - Rebuild ML service container

### Database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:reset` - Reset database (⚠️ deletes all data)

### Testing
- `npm run test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:all` - Run all tests without parallelism

### Setup
- `npm run setup` - Complete first-time setup (Docker + DB + Seed)

---

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Web App** | http://localhost:3000 | Next.js application |
| **ML Service** | http://localhost:8000 | Python FastAPI service |
| **ML Docs** | http://localhost:8000/docs | API documentation |
| **Database** | localhost:5432 | PostgreSQL database |

---

## Default Login Credentials

After seeding, you can login with:

**Admin User:**
- Email: `admin@nexis.com`
- Password: `admin123`

**Sales Analyst:**
- Email: `sales@nexis.com`
- Password: `sales123`

---

## Troubleshooting

### Port Already in Use
If you get port conflicts:
```bash
# Check what's using the port
lsof -i :3000  # or :5432, :8000

# Stop Docker services
npm run docker:down

# Kill the process using the port
kill -9 <PID>
```

### Database Connection Issues
```bash
# Check if database is running
docker ps

# Restart database
npm run docker:down
npm run docker:up
```

### ML Service Not Working
```bash
# Rebuild ML service
npm run docker:rebuild

# Check logs
npm run docker:logs
```

### Reset Everything
```bash
# Stop all services
npm run docker:down

# Remove volumes (⚠️ deletes all data)
docker-compose down -v

# Start fresh
npm run setup
```

---

## Project Structure

```
shankar/
├── src/                    # Next.js application code
│   ├── app/               # App router pages and API routes
│   ├── components/        # React components
│   └── modules/           # Business logic modules
├── prisma/                # Database schema and migrations
├── python-ml-service/     # ML service (FastAPI)
├── docker-compose.yml     # Docker services configuration
└── package.json          # NPM scripts and dependencies
```

---

## Need Help?

Check these files for more information:
- `DEMO_GUIDE.md` - Feature demonstration guide
- `ML_FEEDBACK_IMPLEMENTATION.md` - ML feedback loop details
- `BRUTAL_HONEST_TRUTH.md` - Project status and known issues
