# 🔐 Security Guidelines

## API Key Management

### ⚠️ CRITICAL: Never Commit API Keys

**Files to NEVER commit:**
- `.env` (contains your real API key)
- `backend/data/*.db` (contains operational data)
- Any file with sensitive credentials

**Always use:**
- `.env.template` or `.env.example` (safe templates)
- Environment variables in production
- Secrets managers (AWS Secrets, Vault, etc.)

### .gitignore Configuration

Ensure your `.gitignore` includes:
```gitignore
# Environment variables
.env
.env.local
.env.*.local

# Database files
backend/data/*.db
backend/data/*.db-wal
backend/data/*.jsonl

# Documentation with secrets
# Never commit API keys in markdown files
```

**⚠️ IMPORTANT:** If API keys were previously committed to git history, they must be rotated immediately and purged from history using `git filter-branch` or BFG Repo-Cleaner.

### Check Before Committing

```bash
# Always check what you're about to commit
git status

# Review changes
git diff

# Make sure .env is NOT listed
git ls-files | grep .env
# Should return nothing (or only .env.example/.env.template)
```

---

## Environment Variable Security

### Development

**Use `.env` file (local only):**
```bash
# Copy template
cp .env.template .env

# Add your real key
AIRFRAMES_API_KEY=your_real_key_here
```

### Production

**Use environment variables:**

**Docker:**
```bash
docker run -e AIRFRAMES_API_KEY=$AIRFRAMES_KEY airwave
```

**PM2:**
```bash
pm2 start server.js --env production
```

**Kubernetes:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: airwave-secrets
type: Opaque
data:
  airframes-api-key: <base64-encoded-key>
```

**AWS/Cloud:**
Use AWS Secrets Manager, Google Secret Manager, or Azure Key Vault

---

## API Key Exposure Risks

### If You Accidentally Commit an API Key

**Immediate actions:**

1. **Revoke the key immediately** on Airframes.io
2. **Generate a new key**
3. **Remove from Git history:**

```bash
# Remove from latest commit
git reset HEAD~1
git add .
git commit -m "Remove sensitive data"

# Remove from history (use carefully!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (warning: rewrites history)
git push origin --force --all
```

4. **Consider the key compromised**
5. **Monitor for unauthorized usage**

### Prevention

**Pre-commit hook:**

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash

# Check for .env file
if git diff --cached --name-only | grep -q "^.env$"; then
    echo "Error: Attempting to commit .env file!"
    echo "This file contains sensitive API keys."
    exit 1
fi

# Check for hardcoded keys in code
if git diff --cached | grep -i "AIRFRAMES_API_KEY.*=.*[a-f0-9]\{32,\}"; then
    echo "Error: Possible API key detected in code!"
    exit 1
fi

exit 0
```

```bash
chmod +x .git/hooks/pre-commit
```

---

## Database Security

### Local Development

**SQLite files contain operational data:**
- Aircraft positions
- Message history
- Potentially sensitive communications

**Security measures:**
1. Add `backend/data/*.db` to `.gitignore` ✅
2. Encrypt backups
3. Limit access permissions
4. Don't expose publicly

### Production

**Use encrypted connections:**
```javascript
// PostgreSQL with SSL
const db = new Client({
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca.crt'),
  }
});
```

---

## Network Security

### CORS Configuration

**Development (permissive):**
```javascript
app.use(cors()); // Allow all origins
```

**Production (strict):**
```javascript
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST'],
}));
```

### WebSocket Security

**Use WSS (WebSocket Secure) in production:**
```javascript
// Production
const wss = new WebSocket.Server({
  server: httpsServer, // Use HTTPS server
});
```

**Validate connections:**
```javascript
wss.on('connection', (ws, req) => {
  // Verify origin
  const origin = req.headers.origin;
  if (!allowedOrigins.includes(origin)) {
    ws.close();
    return;
  }
});
```

---

## Input Validation

### Sanitize User Input

```javascript
// Bad
const query = req.query.search;
db.query(`SELECT * FROM messages WHERE text LIKE '%${query}%'`);

// Good
const query = req.query.search;
const stmt = db.prepare('SELECT * FROM messages WHERE text LIKE ?');
stmt.all(`%${sanitize(query)}%`);
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Dependencies Security

### Regular Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Update dependencies
npm update
```

### Automated Security Checks

**GitHub Dependabot:**
Enable in repository settings to auto-detect vulnerabilities

**Snyk Integration:**
```bash
npm install -g snyk
snyk test
snyk monitor
```

---

## Logging Security

### Don't Log Sensitive Data

```javascript
// Bad
console.log('API Key:', process.env.AIRFRAMES_API_KEY);

// Good
console.log('API Key: [REDACTED]');
```

### Log Rotation

```javascript
const winston = require('winston');
require('winston-daily-rotate-file');

const logger = winston.createLogger({
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/airwave-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});
```

---

## Deployment Security

### Environment Checklist

Before deploying:

- [ ] `.env` file is NOT committed
- [ ] API keys are in environment variables
- [ ] Database files are in `.gitignore`
- [ ] CORS is restricted to allowed domains
- [ ] HTTPS/WSS enabled
- [ ] Rate limiting configured
- [ ] Security headers set (Helmet.js)
- [ ] Dependencies updated
- [ ] No console.log with sensitive data
- [ ] Error messages don't expose internals

### Security Headers

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));
```

---

## Incident Response

### If Security Breach Occurs

1. **Immediate:**
   - Revoke compromised API keys
   - Disable affected services
   - Document the incident

2. **Investigation:**
   - Check logs for unauthorized access
   - Identify scope of breach
   - Determine data exposure

3. **Remediation:**
   - Generate new keys
   - Update credentials
   - Patch vulnerabilities
   - Deploy fixes

4. **Prevention:**
   - Update security measures
   - Implement additional monitoring
   - Review access logs regularly

---

## Contact

For security issues:
- **DO NOT** create public GitHub issues
- Email: security@yourdomain.com (create this!)
- Or use GitHub Security Advisories (private reporting)

---

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NPM Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [Airframes.io Security](https://docs.airframes.io/security)

---

**Remember: Security is everyone's responsibility! 🔒**

