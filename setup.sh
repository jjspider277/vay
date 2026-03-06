#!/bin/bash

echo "🚗 Fleet Radar - Starting Application"
echo ""
echo "Installing dependencies..."
echo ""

# Backend
echo "📦 Installing backend dependencies..."
cd backend
pnpm install
cd ..

# Frontend
echo "📦 Installing frontend dependencies..."
cd frontend
pnpm install
cd ..

echo ""
echo "Installation complete!"
echo ""
echo "To start the application:"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend && pnpm start"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd frontend && pnpm start"
echo ""
