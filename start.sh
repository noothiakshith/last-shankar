#!/bin/bash

echo "🚀 Starting NexisERP Application..."
echo ""

# Start Docker services
echo "📦 Starting Docker services (Database + ML Engine)..."
docker-compose up -d db ml-engine

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Check if migrations are needed
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Seed the database (optional - comment out if already seeded)
echo "🌱 Seeding database..."
npx prisma db seed

echo ""
echo "✅ Services are ready!"
echo ""
echo "📊 Database: http://localhost:5432"
echo "🤖 ML Service: http://localhost:8000"
echo "🤖 ML Service Docs: http://localhost:8000/docs"
echo ""
echo "🌐 Now start the Next.js app with:"
echo "   npm run dev"
echo ""
echo "Then visit: http://localhost:3000"
