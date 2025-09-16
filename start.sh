#!/bin/bash

echo "🏛️  Starting Civic Issue Reporter MVP"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Start backend
echo "🚀 Starting backend server..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

echo "🔄 Starting backend on port 5000..."
node server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Backend is running successfully"
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend..."
cd ../frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🔄 Starting React development server on port 3000..."
npm start &
FRONTEND_PID=$!

echo ""
echo "🎉 Application started successfully!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:5000"
echo ""
echo "🗂️  Available pages:"
echo "   • Report Issue: http://localhost:3000/"
echo "   • View Reports: http://localhost:3000/map"
echo "   • Admin Dashboard: http://localhost:3000/admin"
echo ""
echo "⚠️  To stop the application:"
echo "   Press Ctrl+C or run: pkill -f 'node server.js' && pkill -f 'react-scripts'"
echo ""

# Keep script running until user interrupts
wait