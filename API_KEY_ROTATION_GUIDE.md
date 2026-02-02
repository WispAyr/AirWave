# Airframes API Key Rotation Guide

## ⚠️ URGENT: API Key Was Exposed

The Airframes API key was previously committed to the repository in `AirWave/PROJECT_SUMMARY.md`.
This key must be rotated immediately before the repository is made public.

## Step-by-Step Rotation Process

### 1. Generate New API Key

1. Visit https://airframes.io (or your Airframes provider portal)
2. Log in to your account
3. Navigate to **API Keys** or **Settings**
4. Click **Rotate Key** or **Generate New Key**
5. Copy the new key immediately

### 2. Update Local Configuration

1. Open your `.env` file:
   ```bash
   cd /Users/ewanrichardson/Development/airwave/AirWave
   nano .env  # or use your preferred editor
   ```

2. Update the AIRFRAMES_API_KEY:
   ```bash
   AIRFRAMES_API_KEY=your_new_key_here
   ```

3. Save and close

### 3. Revoke Old Key

**IMPORTANT:** Do this AFTER updating your `.env` file.

1. Return to Airframes provider portal
2. Find the old key in your key list
3. Click **Revoke** or **Delete**
4. Confirm revocation

### 4. Purge from Git History

**Choose ONE of these methods:**

#### Method A: BFG Repo-Cleaner (Recommended - Faster)

```bash
# Install BFG
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Navigate to repository root
cd /Users/ewanrichardson/Development/airwave

# Create backup
git clone --mirror . ../airwave-backup.git

# Remove the exposed key pattern
# Replace YOUR_OLD_KEY_HERE with the actual key
bfg --replace-text <(echo "YOUR_OLD_KEY_HERE==>***REMOVED***")

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: Rewrites history)
git push origin --force --all
git push origin --force --tags
```

#### Method B: Git Filter-Branch (Traditional)

```bash
cd /Users/ewanrichardson/Development/airwave

# Create backup
git clone . ../airwave-backup

# Remove specific file from history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch AirWave/PROJECT_SUMMARY.md" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: Rewrites history)
git push origin --force --all
git push origin --force --tags
```

#### Method C: GitHub Secret Scanning

If repository is already on GitHub:

1. GitHub may have automatically detected the key
2. Check **Settings > Security > Secret scanning alerts**
3. Follow GitHub's remediation workflow
4. This handles rotation + notification automatically

### 5. Notify Collaborators (if any)

```bash
# Send message to team
cat << 'MESSAGE'
URGENT: API Key Rotation

The Airframes API key was exposed in git history.
Actions taken:
- Key rotated
- Git history rewritten
- Force push to origin

Please pull latest changes:
  git fetch origin
  git reset --hard origin/main  # WARNING: Discards local changes
  
Update your .env file with new key (check Slack/email)
MESSAGE
```

### 6. Verify Removal

```bash
# Search for old key in current state
git grep "YOUR_OLD_KEY" || echo "✅ Not found in current state"

# Search in entire history
git log --all --full-history -S "YOUR_OLD_KEY" || echo "✅ Not found in history"
```

### 7. Test New Key

```bash
cd AirWave/backend

# Test with new key
node -e "
const axios = require('axios');
const API_KEY = process.env.AIRFRAMES_API_KEY;
console.log('Testing with key:', API_KEY.substring(0, 8) + '...');
// Add actual API test here
console.log('✅ Key works!');
"
```

## ⚠️ Important Warnings

### Force Push Implications

**Before force pushing:**
- Backup repository
- Notify all collaborators
- Choose a maintenance window
- Consider impact on open PRs

**After force push:**
Collaborators must:
```bash
git fetch origin
git reset --hard origin/main
```

### If Repository is Already Public

If the key was exposed publicly:
1. ✅ Rotate key IMMEDIATELY
2. ✅ Purge from history (methods above)
3. ✅ Force push to remote
4. ✅ Monitor for unauthorized usage
5. ⚠️ Consider key compromised
6. 🔍 Review access logs from provider

## Prevention for Future

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for .env file
if git diff --cached --name-only | grep -q "^.env$"; then
    echo "❌ ERROR: Attempting to commit .env file!"
    exit 1
fi

# Check for API key patterns
if git diff --cached | grep -iE "[a-f0-9]{64}"; then
    echo "⚠️  WARNING: Possible API key detected!"
    echo "Please verify before committing."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### .gitignore Updates

Ensure these are in `.gitignore`:
```gitignore
# Environment variables
.env
.env.local
.env.*.local

# Don't commit example with real values
.env.example.filled
```

### GitHub Secret Scanning

Enable in repository settings:
- Settings > Security > Code security and analysis
- Enable "Secret scanning"
- Enable "Push protection"

## Checklist

- [ ] New key generated
- [ ] `.env` file updated
- [ ] Old key revoked
- [ ] Git history purged (choose method)
- [ ] Force push completed
- [ ] Collaborators notified
- [ ] Removal verified
- [ ] New key tested
- [ ] Pre-commit hook installed
- [ ] Secret scanning enabled

## Timeline

**Total Time Required:** ~30-60 minutes

1. Key rotation: 5 minutes
2. Git history cleanup: 10-30 minutes (depends on repo size)
3. Testing: 5 minutes
4. Team notification: variable

## Support

If you encounter issues:

1. **Backup exists:** `../airwave-backup` or `../airwave-backup.git`
2. **Undo force push:** Contact GitHub support (if within 90 days)
3. **Key still works?** Old key might still be active - revoke again
4. **Questions?** Consult Airframes support documentation

## References

- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/
- Git Filter-Branch: https://git-scm.com/docs/git-filter-branch
- GitHub Secret Scanning: https://docs.github.com/en/code-security/secret-scanning
- Airframes Docs: https://docs.airframes.io (if available)

---

**Last Updated:** 2025-10-22  
**Status:** Key rotation required ⚠️
