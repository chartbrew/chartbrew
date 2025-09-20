#!/bin/bash

# Script to test CI pipeline locally before pushing
# This simulates what GitHub Actions will do

set -e

echo "🚀 Testing CI pipeline locally..."

cd server

echo "📦 Installing dependencies..."
npm ci

echo "🔍 Running ESLint..."
npm run lint

echo "📊 Running npm audit..."
npm audit --audit-level=high || echo "⚠️  Audit found issues but continuing..."

echo "🐳 Testing with MySQL containers..."
export CB_DB_DIALECT_DEV=mysql
export FORCE_CONTAINERS=true
npm run test:run

echo "🐘 Testing with PostgreSQL containers..."
export CB_DB_DIALECT_DEV=postgres
export FORCE_CONTAINERS=true
npm run test:run

echo "📈 Generating coverage report..."
export CB_DB_DIALECT_DEV=mysql
export FORCE_CONTAINERS=true
npm run test:coverage

echo "🗂️  Testing SQLite fallback..."
export CB_DB_DIALECT_DEV=sqlite
export FORCE_CONTAINERS=false
npm run test:run

echo "✅ All CI tests passed locally!"
echo ""
echo "Coverage report available at: server/coverage/index.html"
echo "You can now safely push to trigger GitHub Actions."
