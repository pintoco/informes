#!/bin/bash
set -e

# Elemental Pro local development setup
# Usage: ./scripts/local-setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "  Elemental Pro Local Setup"
echo "======================================"

# Check required tools
check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo "ERROR: $1 is not installed"
    exit 1
  fi
}

check_tool node
check_tool npm
check_tool docker

echo ""
echo "Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

echo ""
echo "Step 1: Setting up backend..."
cd "$ROOT_DIR/backend"

if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "Please edit backend/.env with your configuration"
fi

echo "Installing backend dependencies..."
npm install

echo ""
echo "Step 2: Starting PostgreSQL..."
docker-compose up db -d

echo "Waiting for database to be ready..."
sleep 5

echo ""
echo "Step 3: Running database migrations..."
npx prisma generate
npx prisma migrate dev --name init || echo "Migrations may already exist"

echo ""
echo "Step 4: Setting up frontend..."
cd "$ROOT_DIR/frontend"

if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "Please edit frontend/.env with your Cognito configuration"
fi

echo "Installing frontend dependencies..."
npm install

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend && npm run start:dev"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend && npm run dev"
echo ""
echo "API:      http://localhost:3001/api"
echo "Frontend: http://localhost:5173"
echo ""
echo "IMPORTANT: Edit the .env files with your actual values:"
echo "  - backend/.env: Set Cognito credentials and AWS config"
echo "  - frontend/.env: Set Cognito and API URL"
