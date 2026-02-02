#!/bin/bash

echo "🚀 Preparing AIRWAVE for GitHub..."
echo ""

# Check if we have a remote
if ! git remote | grep -q origin; then
    echo "⚠️  No GitHub remote configured!"
    echo ""
    echo "Please run:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/airwave.git"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Show what will be committed
echo "📋 Files to commit:"
git status --short
echo ""

# Verify no sensitive files
echo "🔍 Checking for sensitive files..."
SENSITIVE=$(git ls-files | grep -E "\.env$|\.db$|node_modules" || true)
if [ -n "$SENSITIVE" ]; then
    echo "❌ ERROR: Sensitive files detected!"
    echo "$SENSITIVE"
    exit 1
fi
echo "✅ No sensitive files found"
echo ""

# Commit
echo "💾 Committing changes..."
git add -A
git commit -m "Initial commit: AIRWAVE Mission Control - Aviation Data Platform" || echo "Nothing to commit"

# Push
echo "📤 Pushing to GitHub..."
git push -u origin main || git push -u origin master

echo ""
echo "✅ Successfully pushed to GitHub!"
echo ""
echo "🔗 View your repository at:"
git remote get-url origin | sed 's/\.git$//'
