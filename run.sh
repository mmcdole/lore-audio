#!/bin/bash

# Flix Audio Development Server
echo "🎧 Starting Flix Audio Development Environment..."

# Kill any existing servers
echo "🔄 Cleaning up existing processes..."
killall server 2>/dev/null
pkill -f "npm run dev" 2>/dev/null

# Create necessary directories
echo "📁 Setting up directories..."
mkdir -p /Users/drake/Documents/audiobooks 2>/dev/null
mkdir -p /Users/drake/Documents/import 2>/dev/null

# Start backend with environment variables
echo "🚀 Starting backend server..."
cd backend
if [ ! -f .env ]; then
    echo "❌ Error: backend/.env file not found!"
    exit 1
fi

# Load environment variables and start backend
export $(cat .env | grep -v '^#' | xargs)
go run ./cmd/server &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend..."
cd ../web
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Servers started successfully!"
echo "🖥️  Backend running on: http://localhost:8080"
echo "🌐 Frontend running on: http://localhost:3000"
echo "📋 Backend PID: $BACKEND_PID"
echo "📋 Frontend PID: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait
    echo "✅ All servers stopped"
    exit 0
}

# Trap exit signals
trap cleanup SIGINT SIGTERM

# Wait for processes
wait