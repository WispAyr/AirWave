# ✅ GitHub Upload Checklist

## Pre-Commit Cleanup

### Step 1: Remove Sensitive Files

```bash
cd /Users/ewanrichardson/Development/airwave

# Remove .env files (they contain API keys!)
find . -name ".env" -not -path "*/node_modules/*" -delete
find . -name ".env.local" -not -path "*/node_modules/*" -delete

# Remove database files
find . -name "*.db" -not -path "*/node_modules/*" -delete
find . -name "*.db-wal" -not -path "*/node_modules/*" -delete
find . -name "*.db-shm" -not -path "*/node_modules/*" -delete

# Remove .DS_Store files
find . -name ".DS_Store" -delete

# Remove logs
find . -name "*.log" -not -path "*/node_modules/*" -delete

# Remove node_modules if you want clean repo
# (Users will npm install)
rm -rf node_modules/
rm -rf AirWave/frontend/node_modules/
rm -rf frontend/node_modules/

# Remove package-lock.json (optional, regenerates on install)
rm -f package-lock.json
rm -f AirWave/frontend/package-lock.json
rm -f frontend/package-lock.json
```

### Step 2: Verify .gitignore is Working

```bash
# Check what Git will track
git status

# Should NOT see:
# - .env files
# - *.db files  
# - node_modules/
# - .DS_Store
# - *.log files

# If you see them, they're not being ignored!
```

### Step 3: Create .env.example

```bash
# Create safe template
cat > AirWave/.env.example << 'EOF'
# Airframes.io API Configuration
# Get your free API key from: https://app.airframes.io
AIRFRAMES_API_KEY=your_api_key_here
AIRFRAMES_API_URL=https://api.airframes.io
AIRFRAMES_WS_URL=wss://api.airframes.io

# Server Configuration
PORT=3000
WS_PORT=3001
NODE_ENV=development

# Frontend
FRONTEND_PORT=8501
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
EOF
```

---

## What SHOULD Go to GitHub

### ✅ Source Code Files

```
✅ AirWave/backend/
   ✅ server.js
   ✅ kill-port.js
   ✅ routes/
   ✅ services/
   ✅ utils/
   ❌ data/ (ignored)

✅ AirWave/frontend/
   ✅ app/
   ✅ package.json
   ✅ tsconfig.json
   ✅ next.config.js
   ✅ tailwind.config.js
   ✅ postcss.config.js
   ❌ node_modules/ (ignored)
   ❌ .next/ (ignored)

✅ AirWave/aviation_data_model_v1.0/
   ✅ schemas/
   ✅ csv/
   ✅ ontology/
   ✅ manifests/

✅ Root level:
   ✅ README.md
   ✅ package.json
   ✅ .gitignore
   ✅ .env.example
   ✅ SETUP.md
   ✅ SECURITY.md
   ✅ API.md
   ✅ DATABASE_ARCHITECTURE.md
   ✅ PROJECT_SUMMARY.md
```

### ❌ What Should NOT Go to GitHub

```
❌ .env (contains real API key!)
❌ .env.local
❌ backend/data/*.db (operational data)
❌ backend/data/*.jsonl (message logs)
❌ node_modules/ (dependencies)
❌ .next/ (build output)
❌ package-lock.json (optional)
❌ .DS_Store (OS files)
❌ *.log (log files)
❌ *.swp, *.swo (editor temp files)
❌ .vscode/, .idea/ (IDE settings)
```

---

## Clean Commit Process

### Method 1: Fresh Start (Recommended)

```bash
# 1. Create a new clean directory
cd /Users/ewanrichardson/Development
mkdir airwave-clean
cd airwave-clean

# 2. Initialize Git
git init

# 3. Copy .gitignore first
cp ../airwave/.gitignore .

# 4. Copy source files (excluding ignored items)
rsync -av --exclude='node_modules' \
          --exclude='.next' \
          --exclude='.env' \
          --exclude='*.db*' \
          --exclude='.DS_Store' \
          --exclude='*.log' \
          ../airwave/AirWave/ ./

# 5. Copy root files
cp ../airwave/README.md .
cp ../airwave/package.json .
cp ../airwave/.github .

# 6. Create .env.example
# (see Step 3 above)

# 7. Verify what will be committed
git status
git add .
git status

# 8. Check for sensitive data
git diff --cached | grep -i "api.*key\|secret\|password"
# Should return nothing!

# 9. Commit
git commit -m "Initial commit: AIRWAVE Mission Control"

# 10. Push to GitHub
git remote add origin https://github.com/yourusername/airwave.git
git branch -M main
git push -u origin main
```

### Method 2: Clean Current Repo

```bash
cd /Users/ewanrichardson/Development/airwave

# 1. Backup first!
cd ..
cp -r airwave airwave-backup

cd airwave

# 2. Remove Git history (fresh start)
rm -rf .git

# 3. Run cleanup (see Step 1 above)

# 4. Initialize new Git repo
git init
git add .

# 5. Verify before committing
git status
# Review carefully!

# 6. Commit
git commit -m "Initial commit: AIRWAVE Mission Control"

# 7. Push
git remote add origin https://github.com/yourusername/airwave.git
git branch -M main
git push -u origin main
```

---

## Security Verification

### Before Pushing, Verify:

```bash
# 1. No .env files
find . -name ".env" -not -path "*/node_modules/*"
# Should return nothing

# 2. No database files
find . -name "*.db" -not -path "*/node_modules/*"
# Should return nothing

# 3. No API keys in code
grep -r "68e09509\|airframes.*key" . --exclude-dir=node_modules --exclude-dir=.git
# Should return nothing

# 4. Check what Git will upload
git ls-files | grep -E "\.env$|\.db$|\.DS_Store$"
# Should return nothing

# 5. Review all staged files
git status
```

---

## File Structure for GitHub

```
airwave/                          # Root
├── .github/
│   └── workflows/
│       └── ci.yml               ✅ CI/CD config
├── AirWave/                     # Main application
│   ├── backend/
│   │   ├── server.js           ✅ Main server
│   │   ├── kill-port.js        ✅ Port cleanup
│   │   ├── routes/             ✅ API routes
│   │   ├── services/           ✅ Services
│   │   ├── utils/              ✅ Utilities
│   │   └── data/               ❌ IGNORED (databases)
│   ├── frontend/
│   │   ├── app/                ✅ React components
│   │   ├── package.json        ✅ Frontend deps
│   │   ├── node_modules/       ❌ IGNORED
│   │   └── .next/              ❌ IGNORED
│   └── aviation_data_model_v1.0/
│       ├── schemas/            ✅ JSON schemas
│       ├── csv/                ✅ Reference data
│       └── ontology/           ✅ OWL ontology
├── .gitignore                  ✅ Git ignore rules
├── .env.example                ✅ Safe template
├── package.json                ✅ Backend deps
├── README.md                   ✅ Main documentation
├── SETUP.md                    ✅ Setup guide
├── SECURITY.md                 ✅ Security guide
├── API.md                      ✅ API reference
└── node_modules/               ❌ IGNORED
```

---

## Common Mistakes to Avoid

### ❌ DON'T:

1. Commit `.env` files with real API keys
2. Commit `node_modules/` (too large, regenerates)
3. Commit database files (operational data)
4. Commit `.DS_Store` or other OS files
5. Commit log files
6. Use `git add .` without checking `git status` first
7. Force push without backup

### ✅ DO:

1. Use `.env.example` with placeholders
2. Review `git status` before committing
3. Check `git diff --cached` before pushing
4. Keep `.gitignore` up to date
5. Backup before major Git operations
6. Test clone in fresh directory
7. Document setup process

---

## Final Checks

### Before You Push:

```bash
# 1. Does it build?
npm install
npm run dev

# 2. Can someone else set it up?
# Test in new directory:
cd /tmp
git clone /path/to/your/repo test-airwave
cd test-airwave
cp .env.example .env
# Add test API key to .env
npm install
cd AirWave/frontend && npm install
npm run dev
# Should work!

# 3. No secrets exposed?
git log --all --full-history --source -- "*/.env"
# Should be empty

# 4. README accurate?
# Read through README.md and verify all steps work
```

---

## Quick Reference

### Clean & Push Checklist:

```bash
# ☐ Delete all .env files
# ☐ Delete all .db files
# ☐ Delete all .DS_Store files  
# ☐ Delete node_modules/
# ☐ Create .env.example
# ☐ Verify .gitignore
# ☐ Run: git status
# ☐ Review what will be committed
# ☐ Search for API keys in code
# ☐ Test build works
# ☐ git add .
# ☐ git commit
# ☐ git push
```

---

## Need Help?

If you accidentally committed sensitive data:

1. **DON'T** push to GitHub yet!
2. Remove sensitive file from Git:
   ```bash
   git rm --cached .env
   git commit --amend
   ```
3. If already pushed, consider:
   - Revoking API keys
   - Force pushing clean history (careful!)
   - Creating new repo

---

**Ready to push? Double-check everything above! 🚀**


