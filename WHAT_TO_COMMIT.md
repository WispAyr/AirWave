# 📋 What to Commit to GitHub

## ✅ SAFE TO COMMIT

### Source Code
```
✅ AirWave/backend/server.js
✅ AirWave/backend/kill-port.js
✅ AirWave/backend/routes/**/*.js
✅ AirWave/backend/services/**/*.js
✅ AirWave/backend/utils/**/*.js
✅ AirWave/frontend/app/**/*.tsx
✅ AirWave/frontend/app/**/*.ts
✅ AirWave/frontend/app/**/*.css
```

### Configuration (without secrets)
```
✅ package.json
✅ AirWave/frontend/package.json
✅ AirWave/frontend/tsconfig.json
✅ AirWave/frontend/next.config.js
✅ AirWave/frontend/tailwind.config.js
✅ AirWave/frontend/postcss.config.js
✅ .gitignore
✅ .env.example (with placeholders!)
```

### Documentation
```
✅ README.md
✅ SETUP.md
✅ SECURITY.md
✅ API.md
✅ DATABASE_ARCHITECTURE.md
✅ PROJECT_SUMMARY.md
✅ GITHUB_CHECKLIST.md
```

### Aviation Data Model
```
✅ AirWave/aviation_data_model_v1.0/schemas/**/*.json
✅ AirWave/aviation_data_model_v1.0/csv/**/*.csv
✅ AirWave/aviation_data_model_v1.0/ontology/**/*.ttl
✅ AirWave/aviation_data_model_v1.0/manifests/**/*
```

### CI/CD
```
✅ .github/workflows/ci.yml
```

---

## ❌ NEVER COMMIT

### Secrets & Credentials
```
❌ .env (real API keys!)
❌ .env.local
❌ .env.*.local
❌ Any file with API keys
❌ Any file with passwords
❌ Any file with tokens
```

### Database & Data
```
❌ *.db
❌ *.db-wal
❌ *.db-shm
❌ *.sqlite
❌ *.jsonl
❌ AirWave/backend/data/**/*
❌ backend/data/**/*
```

### Dependencies
```
❌ node_modules/
❌ AirWave/frontend/node_modules/
❌ backend/node_modules/
```

### Build Outputs
```
❌ .next/
❌ dist/
❌ build/
❌ out/
❌ AirWave/frontend/.next/
```

### Logs
```
❌ *.log
❌ npm-debug.log*
❌ yarn-debug.log*
❌ logs/
```

### OS & IDE Files
```
❌ .DS_Store
❌ Thumbs.db
❌ .vscode/
❌ .idea/
❌ *.swp
❌ *.swo
```

### Lock Files (optional - your choice)
```
⚠️  package-lock.json (optional)
⚠️  yarn.lock (optional)
```

---

## Quick Verification

### Run This Before Committing:

```bash
# Check what will be committed
git status

# Should NOT see any of these:
# - .env
# - *.db
# - node_modules/
# - .DS_Store
# - *.log

# If you see them, they're not being ignored!
# Check your .gitignore file
```

### Search for Sensitive Data:

```bash
# Search for API keys in tracked files
git ls-files | xargs grep -l "68e0950914ba09c4493814b9d6da59294ee13c0deb45dbcdb74b34e327f74821"

# Should return nothing!

# Search for any suspicious patterns
git ls-files | xargs grep -E "api.*key.*=|secret.*=|password.*=" | grep -v ".example"

# Should only show .env.example placeholders
```

---

## File Count Estimate

Your repository should be approximately:
- **~50-60 files** of source code
- **~23 schemas** (aviation data model)
- **~5-10 documentation files**
- **~5 config files**

**Total: ~80-100 files**

If you see hundreds or thousands of files, you might be including `node_modules/`!

---

## Ready to Commit?

### Final Checklist:

```bash
# ☐ Ran cleanup.sh
# ☐ No .env files
# ☐ No .db files
# ☐ No .DS_Store files
# ☐ Created .env.example
# ☐ Verified .gitignore
# ☐ git status looks clean
# ☐ Searched for API keys (found none)
# ☐ File count reasonable (~100 files)
```

### Commit Commands:

```bash
git add .
git status  # Review one more time!
git commit -m "Initial commit: AIRWAVE Mission Control"
git remote add origin https://github.com/yourusername/airwave.git
git push -u origin main
```

---

**You're ready for GitHub! 🚀**


