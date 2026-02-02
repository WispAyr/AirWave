#!/bin/bash

echo "🧹 Cleaning AIRWAVE for GitHub..."
echo ""

# Remove .env files
echo "🔑 Removing .env files..."
find . -name ".env" -not -path "*/node_modules/*" -delete
find . -name ".env.local" -not -path "*/node_modules/*" -delete

# Remove database files
echo "💾 Removing database files..."
find . -name "*.db" -not -path "*/node_modules/*" -delete
find . -name "*.db-wal" -not -path "*/node_modules/*" -delete
find . -name "*.db-shm" -not -path "*/node_modules/*" -delete
find . -name "*.jsonl" -not -path "*/node_modules/*" -delete

# Remove .DS_Store
echo "🗑️  Removing .DS_Store files..."
find . -name ".DS_Store" -delete

# Remove logs
echo "📋 Removing log files..."
find . -name "*.log" -not -path "*/node_modules/*" -delete

# Remove node_modules (optional - uncomment if you want)
# echo "📦 Removing node_modules..."
# rm -rf node_modules/
# rm -rf */node_modules/
# rm -rf */*/node_modules/

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "⚠️  Next steps:"
echo "1. Create .env.example file"
echo "2. Run: git status"
echo "3. Verify no sensitive files listed"
echo "4. Run: git add ."
echo "5. Run: git commit -m 'Initial commit'"
echo ""
